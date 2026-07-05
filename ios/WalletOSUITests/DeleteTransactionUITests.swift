import XCTest

/// Verifica que el borrado por long-press en Patrimonio funciona (antes usaba `.swipeActions`, que
/// no dispara fuera de un `List`). Requiere el backend local con una sesión que tenga al menos una
/// transacción; si no la hay, primero crea una.
final class DeleteTransactionUITests: XCTestCase {
    func testLongPressDeletesATransaction() {
        let app = XCUIApplication()
        app.launch()

        reachHome(app)
        ensureAtLeastOneTransaction(app)

        // La primera fila de "últimas transacciones": long-press → menú contextual → Borrar.
        let firstRow = app.staticTexts.matching(identifier: "").allElementsBoundByIndex.first
        let transactionsHeader = app.staticTexts["ÚLTIMAS TRANSACCIONES"]
        XCTAssertTrue(transactionsHeader.waitForExistence(timeout: 10))

        // Long-press sobre cualquier fila con importe (contiene "€").
        let row = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "€"))
            .allElementsBoundByIndex
            .first { $0.label.contains("−") || $0.label.contains("+") }
        guard let row else {
            XCTFail("No hay ninguna transacción que borrar.")
            return
        }
        row.press(forDuration: 1.0)

        let deleteButton = app.buttons["Borrar"]
        XCTAssertTrue(deleteButton.waitForExistence(timeout: 5), "el menú contextual muestra Borrar")
        deleteButton.tap()

        // Aparece el toast de deshacer.
        XCTAssertTrue(app.staticTexts["Transacción borrada"].waitForExistence(timeout: 5))
        attachScreenshot(named: "01-undo-toast")
    }

    private func ensureAtLeastOneTransaction(_ app: XCUIApplication) {
        if app.staticTexts["Sin movimientos. Añade el primero."].waitForExistence(timeout: 3) {
            app.buttons["＋ Añadir"].tap()
            XCTAssertTrue(app.navigationBars["Nueva transacción"].waitForExistence(timeout: 5))
            for digit in ["5", "0", "0"] { app.buttons[digit].firstMatch.tap() }
            app.buttons["Guardar"].tap()
            XCTAssertTrue(app.staticTexts["PATRIMONIO"].waitForExistence(timeout: 10))
        }
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
        type("Test Delete", into: app.textFields["Nombre"], in: app)
        type("delete-ui-\(Int(Date().timeIntervalSince1970))@test.com", into: app.textFields["Email"], in: app)
        let passwordField = app.secureTextFields["Contraseña"]
        passwordField.tap()
        let closeStrongPasswordSuggestion = app.buttons["Cerrar"]
        let suggestionAppeared = closeStrongPasswordSuggestion.waitForExistence(timeout: 3)
        if suggestionAppeared { closeStrongPasswordSuggestion.tap() }
        type("password123", into: passwordField, in: app, tapFirst: !suggestionAppeared)
        app.buttons["authSubmitButton"].tap()
    }

    private func type(_ text: String, into field: XCUIElement, in app: XCUIApplication, tapFirst: Bool = true) {
        if tapFirst { field.tap() }
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
