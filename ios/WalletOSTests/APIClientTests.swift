import XCTest

@testable import WalletOS

// Fixtures de test: se permite el unwrap forzado sobre valores conocidos.
// swiftlint:disable force_unwrapping

private struct SampleDTO: Decodable, Equatable {
    let id: String
    let displayName: String
}

final class APIClientTests: XCTestCase {
    private let baseURL = URL(fileURLWithPath: "/").appendingPathComponent("api")
    private var client: APIClient!

    override func setUp() {
        super.setUp()
        client = APIClient(baseURL: URL(string: "http://localhost/api")!, session: MockURLProtocol.session())
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        client = nil
        super.tearDown()
    }

    func testDecodesResponseAndConvertsSnakeCase() async throws {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 200, json: #"{"id":"1","display_name":"Ana"}"#)
        }
        let dto: SampleDTO = try await client.send(Endpoint(path: "me", method: .get, requiresAuth: false))
        XCTAssertEqual(dto, SampleDTO(id: "1", displayName: "Ana"))
    }

    func testMapsHTTPStatusCodesToAPIError() async {
        let cases: [(status: Int, expected: APIError)] = [
            (404, .notFound),
            (400, .validation(details: "")),
            (409, .conflict(details: "")),
            (429, .rateLimited),
            (500, .server(status: 500)),
        ]
        for testCase in cases {
            MockURLProtocol.handler = { request in
                MockURLProtocol.response(url: request.url!, status: testCase.status)
            }
            await assertThrowsAsync(
                try await client.send(Endpoint(path: "me", method: .get, requiresAuth: false)) as SampleDTO
            ) { error in
                XCTAssertEqual(error as? APIError, testCase.expected, "status \(testCase.status)")
            }
        }
    }

    func testMapsNoConnectivityToOffline() async {
        MockURLProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }
        await assertThrowsAsync(
            try await client.send(Endpoint(path: "me", method: .get, requiresAuth: false)) as SampleDTO
        ) { error in
            XCTAssertEqual(error as? APIError, .offline)
        }
    }

    func testUnauthorizedWithoutInterceptorIsNotRetried() async {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 401)
        }
        await assertThrowsAsync(
            try await client.send(Endpoint(path: "me", method: .get)) as SampleDTO
        ) { error in
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }
}

/// `assertThrowsAsync` para funciones `async`.
func assertThrowsAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath,
    line: UInt = #line,
    _ errorHandler: (Error) -> Void
) async {
    do {
        _ = try await expression()
        XCTFail("Se esperaba un error. \(message())", file: file, line: line)
    } catch {
        errorHandler(error)
    }
}

// swiftlint:enable force_unwrapping
