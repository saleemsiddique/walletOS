import XCTest

/// Recorre el onboarding real contra el backend local: registro (si hace falta) → wizard de setup
/// (banco → wallet) → destino autenticado. Requiere el backend arrancado en `http://localhost/api`.
///
/// El Keychain del simulador sobrevive a `simctl erase` en algunas versiones de Xcode: si el
/// dispositivo ya tiene una sesión válida, la app aterriza directamente en el wizard (o en Home si
/// ya tiene bancos). El test detecta el punto de entrada real en vez de asumir siempre el registro.
final class SetupFlowUITests: XCTestCase {
    func testNewUserCompletesSetupWizardAfterRegistering() {
        let app = XCUIApplication()
        app.launch()

        registerIfNeeded(app)

        let bankTitle = app.staticTexts["Tu banco"]
        guard bankTitle.waitForExistence(timeout: 10) else {
            XCTFail("La sesión activa ya tiene bancos: relanza en un simulador sin Keychain previo para ver el wizard.")
            return
        }
        attachScreenshot(named: "01-setup-bank-step")

        type("Santander", into: app.textFields["Nombre del banco"], in: app)
        app.buttons["Siguiente"].tap()

        let walletTitle = app.staticTexts["Tu primer wallet"]
        XCTAssertTrue(walletTitle.waitForExistence(timeout: 5))
        attachScreenshot(named: "02-setup-wallet-step")

        type("Nómina", into: app.textFields["Nombre del wallet"], in: app)
        app.buttons["Empezar"].tap()

        // Sale del wizard: hoy aterriza en el placeholder de Home (Rama 15 lo sustituye).
        XCTAssertTrue(app.staticTexts["WalletOS"].waitForExistence(timeout: 10))
        attachScreenshot(named: "03-setup-finished")
    }

    /// Solo registra si la app arrancó en la pantalla de auth; si el Keychain ya traía sesión
    /// (ver nota de clase), no hay nada que hacer aquí.
    private func registerIfNeeded(_ app: XCUIApplication) {
        let createAccountTab = app.buttons["Crear cuenta"]
        guard createAccountTab.waitForExistence(timeout: 5) else { return }
        createAccountTab.tap()

        let nameField = app.textFields["Nombre"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        type("Test Onboarding", into: nameField, in: app)

        let emailField = app.textFields["Email"]
        type("onboarding-ui-\(Int(Date().timeIntervalSince1970))@test.com", into: emailField, in: app)

        let passwordField = app.secureTextFields["Contraseña"]
        passwordField.tap()
        // El SecureField de registro usa `.textContentType(.newPassword)`: iOS ofrece generar una
        // contraseña segura y tapa el campo con ese sheet. Cerrarlo antes de escribir la propia.
        let closeStrongPasswordSuggestion = app.buttons["Cerrar"]
        let suggestionAppeared = closeStrongPasswordSuggestion.waitForExistence(timeout: 3)
        if suggestionAppeared {
            closeStrongPasswordSuggestion.tap()
        }
        type("password123", into: passwordField, in: app, tapFirst: !suggestionAppeared)

        app.buttons["authSubmitButton"].tap()
    }

    /// Toca el campo, espera a que el teclado tenga foco real (evita escribir sobre un campo que
    /// aún no respondió al tap, algo frecuente justo después de una transición animada) y escribe
    /// el texto. Reintenta el tap unas pocas veces si el teclado tarda en aparecer.
    private func type(_ text: String, into field: XCUIElement, in app: XCUIApplication, tapFirst: Bool = true) {
        if tapFirst {
            field.tap()
        }
        var attempts = 0
        while !app.keyboards.element.waitForExistence(timeout: 2), attempts < 3 {
            field.tap()
            attempts += 1
        }
        XCTAssertTrue(app.keyboards.element.exists, "El teclado no apareció para \(field)")
        field.typeText(text)
    }

    private func attachScreenshot(named name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
