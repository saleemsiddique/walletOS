import XCTest

@testable import WalletOS

// Fixtures de test: se permite el unwrap forzado sobre valores conocidos.
// swiftlint:disable force_unwrapping

private struct AuthSampleDTO: Decodable {
    let id: String
    let displayName: String
}

/// Token store en memoria para tests (la implementación real es Keychain, Rama 5).
private actor MockTokenStore: TokenStoring {
    private var access: String?
    private var refresh: String?

    init(access: String?, refresh: String?) {
        self.access = access
        self.refresh = refresh
    }

    var accessToken: String? { access }
    var refreshToken: String? { refresh }

    func saveTokens(access: String, refresh: String) {
        self.access = access
        self.refresh = refresh
    }

    func clear() {
        access = nil
        refresh = nil
    }
}

/// Contador seguro entre hilos (el handler del `URLProtocol` corre en hilos de `URLSession`).
private final class AtomicCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var value = 0

    func increment() {
        lock.lock()
        value += 1
        lock.unlock()
    }

    var current: Int {
        lock.lock()
        defer { lock.unlock() }
        return value
    }
}

final class AuthInterceptorTests: XCTestCase {
    private let baseURL = URL(string: "http://localhost/api")!
    private let meEndpoint = Endpoint(path: "me", method: .get)

    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    private func makeClient(store: TokenStoring, onLogout: @escaping @Sendable () -> Void = {}) -> APIClient {
        let session = MockURLProtocol.session()
        let interceptor = AuthInterceptor(tokenStore: store, session: session, baseURL: baseURL, onLogout: onLogout)
        return APIClient(baseURL: baseURL, session: session, interceptor: interceptor)
    }

    func testRefreshesOnceAndRetriesWithTheNewToken() async throws {
        let store = MockTokenStore(access: "old", refresh: "r1")
        let client = makeClient(store: store)
        MockURLProtocol.handler = { request in
            if request.url!.path.hasSuffix("/refresh") {
                return MockURLProtocol.response(
                    url: request.url!, status: 200,
                    json: #"{"access_token":"new","refresh_token":"r2"}"#)
            }
            let authorized = request.value(forHTTPHeaderField: "Authorization") == "Bearer new"
            return MockURLProtocol.response(
                url: request.url!, status: authorized ? 200 : 401,
                json: authorized ? #"{"id":"1","display_name":"Ana"}"# : "")
        }

        let dto: AuthSampleDTO = try await client.send(meEndpoint)

        XCTAssertEqual(dto.id, "1")
        let stored = await store.accessToken
        XCTAssertEqual(stored, "new")
    }

    func testFailedRefreshEmitsLogoutAndThrowsUnauthorized() async {
        let store = MockTokenStore(access: "old", refresh: "r1")
        let logout = AtomicCounter()
        let client = makeClient(store: store, onLogout: { logout.increment() })
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 401)
        }

        await assertThrowsAsync(try await client.send(meEndpoint) as AuthSampleDTO) { error in
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
        XCTAssertEqual(logout.current, 1)
    }

    func testConcurrentUnauthorizedRequestsTriggerASingleRefresh() async throws {
        let store = MockTokenStore(access: "old", refresh: "r1")
        let refreshCount = AtomicCounter()
        let client = makeClient(store: store)
        MockURLProtocol.handler = { request in
            if request.url!.path.hasSuffix("/refresh") {
                refreshCount.increment()
                Thread.sleep(forTimeInterval: 0.2)  // ensancha la ventana para observar el coalescing
                return MockURLProtocol.response(
                    url: request.url!, status: 200,
                    json: #"{"access_token":"new","refresh_token":"r2"}"#)
            }
            let authorized = request.value(forHTTPHeaderField: "Authorization") == "Bearer new"
            return MockURLProtocol.response(
                url: request.url!, status: authorized ? 200 : 401,
                json: authorized ? #"{"id":"1","display_name":"Ana"}"# : "")
        }

        async let first: AuthSampleDTO = client.send(meEndpoint)
        async let second: AuthSampleDTO = client.send(Endpoint(path: "wallets", method: .get))
        _ = try await (first, second)

        XCTAssertEqual(refreshCount.current, 1)
    }
}

// swiftlint:enable force_unwrapping
