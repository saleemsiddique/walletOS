import XCTest

final class LaunchUITests: XCTestCase {
    func testAppLaunchesAndShowsPlaceholder() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["WalletOS"].waitForExistence(timeout: 5))
    }
}
