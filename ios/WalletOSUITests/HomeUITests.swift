import XCTest

/// Recorre Patrimonio (Rama 15) contra el backend local: llega a la tab bar de 4 tabs (creando
/// sesión/banco si hace falta, igual que `SetupFlowUITests`), navega entre tabs y abre "ver todas".
/// Requiere el backend arrancado en `http://localhost/api`.
final class HomeUITests: XCTestCase {
    func testNavigatesTheFourTabsAndOpensAllAccounts() {
        let app = XCUIApplication()
        app.launch()

        reachHome(app)
        attachScreenshot(named: "01-patrimonio")

        XCTAssertTrue(app.staticTexts["PATRIMONIO"].waitForExistence(timeout: 10))

        app.tabBars.buttons["Actividad"].tap()
        XCTAssertTrue(app.staticTexts["Próximamente."].waitForExistence(timeout: 5))
        attachScreenshot(named: "02-actividad-placeholder")

        app.tabBars.buttons["Insights"].tap()
        XCTAssertTrue(app.staticTexts["Próximamente."].waitForExistence(timeout: 5))

        app.tabBars.buttons["Ajustes"].tap()
        XCTAssertTrue(app.staticTexts["Próximamente."].waitForExistence(timeout: 5))
        attachScreenshot(named: "03-ajustes-placeholder")

        app.tabBars.buttons["Patrimonio"].tap()
        let verTodas = app.buttons["ver todas"]
        guard verTodas.waitForExistence(timeout: 5) else {
            // Usuario sin wallets visibles en esta sesión: no hay "ver todas" que probar.
            return
        }
        verTodas.tap()
        XCTAssertTrue(app.navigationBars["Mis cuentas"].waitForExistence(timeout: 5))
        attachScreenshot(named: "04-accounts-view")
    }

    /// Llega a la tab bar autenticada: registra si hace falta y completa el wizard de setup si el
    /// usuario todavía no tiene bancos (mismo detector de punto de entrada que `SetupFlowUITests`).
    private func reachHome(_ app: XCUIApplication) {
        registerIfNeeded(app)

        if app.staticTexts["Tu banco"].waitForExistence(timeout: 5) {
            type("Santander", into: app.textFields["Nombre del banco"], in: app)
            app.buttons["Siguiente"].tap()
            XCTAssertTrue(app.staticTexts["Tu primer wallet"].waitForExistence(timeout: 5))
            type("Nómina", into: app.textFields["Nombre del wallet"], in: app)
            app.buttons["Empezar"].tap()
        }

        XCTAssertTrue(app.tabBars.buttons["Patrimonio"].waitForExistence(timeout: 10))
    }

    private func registerIfNeeded(_ app: XCUIApplication) {
        let createAccountTab = app.buttons["Crear cuenta"]
        guard createAccountTab.waitForExistence(timeout: 5) else { return }
        createAccountTab.tap()

        let nameField = app.textFields["Nombre"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        type("Test Home", into: nameField, in: app)

        let emailField = app.textFields["Email"]
        type("home-ui-\(Int(Date().timeIntervalSince1970))@test.com", into: emailField, in: app)

        let passwordField = app.secureTextFields["Contraseña"]
        passwordField.tap()
        let closeStrongPasswordSuggestion = app.buttons["Cerrar"]
        let suggestionAppeared = closeStrongPasswordSuggestion.waitForExistence(timeout: 3)
        if suggestionAppeared {
            closeStrongPasswordSuggestion.tap()
        }
        type("password123", into: passwordField, in: app, tapFirst: !suggestionAppeared)

        app.buttons["authSubmitButton"].tap()
    }

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
