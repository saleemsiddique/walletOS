import XCTest

/// Abre el modal de añadir transacción desde Patrimonio, mete un importe con el numpad y guarda.
/// Requiere el backend arrancado en `http://localhost/api` con una sesión que ya tenga un wallet.
final class AddTransactionUITests: XCTestCase {
    func testAddExpenseFromPatrimonio() {
        let app = XCUIApplication()
        app.launch()

        reachHome(app)

        guard app.buttons["＋ Añadir"].waitForExistence(timeout: 10) else {
            XCTFail("No hay botón de añadir: la sesión necesita al menos un wallet.")
            return
        }
        app.buttons["＋ Añadir"].tap()

        XCTAssertTrue(app.navigationBars["Nueva transacción"].waitForExistence(timeout: 5))
        attachScreenshot(named: "01-modal-abierto")

        // Importe 12,34 € con el numpad (cada dígito desplaza los céntimos).
        for digit in ["1", "2", "3", "4"] {
            app.buttons[digit].firstMatch.tap()
        }
        attachScreenshot(named: "02-importe-introducido")

        let saveButton = app.buttons["Guardar"]
        XCTAssertTrue(saveButton.waitForExistence(timeout: 3))
        saveButton.tap()

        // El modal se cierra y volvemos a Patrimonio.
        XCTAssertTrue(app.staticTexts["PATRIMONIO"].waitForExistence(timeout: 10))
        attachScreenshot(named: "03-vuelta-a-patrimonio")
    }

    private func reachHome(_ app: XCUIApplication) {
        registerIfNeeded(app)

        if app.staticTexts["Tu banco"].waitForExistence(timeout: 5) {
            type("ING", into: app.textFields["Nombre del banco"], in: app)
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
        type("Test Add", into: nameField, in: app)
        type("add-ui-\(Int(Date().timeIntervalSince1970))@test.com", into: app.textFields["Email"], in: app)

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
