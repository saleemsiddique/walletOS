import XCTest

@testable import WalletOS

final class DeepLinkRouterTests: XCTestCase {
    func testResetURLExtractsTheToken() {
        let url = URL(string: "walletos://reset?token=abc")!

        XCTAssertEqual(DeepLinkRouter.deepLink(from: url), .resetPassword(token: "abc"))
    }

    func testResetURLWithoutTokenIsIgnored() {
        XCTAssertNil(DeepLinkRouter.deepLink(from: URL(string: "walletos://reset")!))
        XCTAssertNil(DeepLinkRouter.deepLink(from: URL(string: "walletos://reset?token=")!))
        XCTAssertNil(DeepLinkRouter.deepLink(from: URL(string: "walletos://reset?otro=abc")!))
    }

    func testForeignSchemesAndUnknownHostsAreIgnored() {
        XCTAssertNil(DeepLinkRouter.deepLink(from: URL(string: "https://reset?token=abc")!))
        XCTAssertNil(DeepLinkRouter.deepLink(from: URL(string: "walletos://otracosa?token=abc")!))
    }
}
