import XCTest

@testable import WalletOS

// Fixtures de test: se permite el unwrap forzado sobre valores conocidos.
// swiftlint:disable force_unwrapping

final class AppEnvironmentTests: XCTestCase {
    override func tearDown() {
        AppEnvironment.clearDebugOverride()
        super.tearDown()
    }

    func testBaseURLPerEnvironment() {
        XCTAssertEqual(AppEnvironment.local.baseURL, URL(string: "http://localhost/api"))
        XCTAssertEqual(AppEnvironment.staging.baseURL, URL(string: "https://staging-api.walletos.app/api"))
        XCTAssertEqual(AppEnvironment.prod.baseURL, URL(string: "https://api.walletos.app/api"))
    }

    func testDefaultsToLocalInDebugWithoutOverride() {
        AppEnvironment.clearDebugOverride()
        XCTAssertEqual(AppEnvironment.current, .local)
    }

    func testDebugOverrideChangesCurrentEnvironment() {
        AppEnvironment.overrideForDebug(.staging)
        XCTAssertEqual(AppEnvironment.current, .staging)
    }

    func testAPIClientDefaultsToTheCurrentEnvironmentBaseURL() async throws {
        AppEnvironment.overrideForDebug(.staging)
        defer { MockURLProtocol.handler = nil }

        var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            return MockURLProtocol.response(url: request.url!, status: 200, json: "{}")
        }
        let client = APIClient(session: MockURLProtocol.session())

        try await client.send(Endpoint(path: "me", method: .get, requiresAuth: false)) as EmptyDecodable

        XCTAssertEqual(capturedURL?.host, AppEnvironment.staging.baseURL.host)
    }
}

private struct EmptyDecodable: Decodable {}

// swiftlint:enable force_unwrapping
