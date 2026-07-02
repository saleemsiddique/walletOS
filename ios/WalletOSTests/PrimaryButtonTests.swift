import XCTest

@testable import WalletOS

final class PrimaryButtonTests: XCTestCase {
    /// El objetivo de toque primario del design system (§6) es 56–64 pt.
    func testPrimaryButtonMeetsMinimumTouchHeight() {
        XCTAssertGreaterThanOrEqual(PrimaryButton.minHeight, 56)
    }
}
