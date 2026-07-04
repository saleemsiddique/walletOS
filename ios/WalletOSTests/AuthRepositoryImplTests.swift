import XCTest

@testable import WalletOS

// Fixtures de test: se permite el unwrap forzado sobre valores conocidos.
// swiftlint:disable force_unwrapping

final class AuthRepositoryImplTests: XCTestCase {
    private var authState: AuthState!
    private var tokenStore: TokenStore!
    private var repository: AuthRepositoryImpl!

    private let authResponseJSON = #"""
        {
          "user": { "id": "u1", "email": "ana@mail.com", "name": "Ana" },
          "access_token": "access-1",
          "refresh_token": "refresh-1"
        }
        """#

    override func setUp() async throws {
        try await super.setUp()
        authState = await AuthState()
        tokenStore = TokenStore(secureStore: InMemorySecureStore(), authState: authState)
        let client = APIClient(baseURL: URL(string: "http://localhost/api")!, session: MockURLProtocol.session())
        repository = AuthRepositoryImpl(remote: AuthRemoteDataSource(client: client), tokenStore: tokenStore)
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        repository = nil
        tokenStore = nil
        authState = nil
        super.tearDown()
    }

    func testLoginUserWithValidCredentialsSavesTokensAndSignsIn() async throws {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 200, json: self.authResponseJSON)
        }

        try await LoginUser(repository: repository).execute(email: "ana@mail.com", password: "12345678")

        let access = await tokenStore.accessToken
        let refresh = await tokenStore.refreshToken
        let status = await authState.status
        XCTAssertEqual(access, "access-1")
        XCTAssertEqual(refresh, "refresh-1")
        XCTAssertEqual(status, .signedIn)
    }

    func testRegisterUserSavesTokensAndSignsIn() async throws {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 201, json: self.authResponseJSON)
        }

        try await RegisterUser(repository: repository)
            .execute(email: "ana@mail.com", password: "12345678", name: "Ana")

        let access = await tokenStore.accessToken
        let status = await authState.status
        XCTAssertEqual(access, "access-1")
        XCTAssertEqual(status, .signedIn)
    }

    func testAppleSignInExchangesTheIdentityTokenAndSignsIn() async throws {
        nonisolated(unsafe) var requestedPath: String?
        MockURLProtocol.handler = { request in
            requestedPath = request.url!.path
            return MockURLProtocol.response(url: request.url!, status: 200, json: self.authResponseJSON)
        }

        try await SignInWithApple(repository: repository).execute(identityToken: "jwt-apple", name: "Ana")

        let access = await tokenStore.accessToken
        let status = await authState.status
        XCTAssertEqual(requestedPath, "/api/apple")
        XCTAssertEqual(access, "access-1")
        XCTAssertEqual(status, .signedIn)
    }

    func testRejectedAppleTokenDoesNotSaveTokens() async {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 401)
        }

        await assertThrowsAsync(
            try await self.repository.signInWithApple(identityToken: "jwt-invalido", name: nil)
        ) { error in
            XCTAssertEqual(error as? APIError, .unauthorized)
        }

        let access = await tokenStore.accessToken
        XCTAssertNil(access)
    }

    func testUnauthorizedLoginDoesNotSaveTokens() async {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 401)
        }

        await assertThrowsAsync(
            try await self.repository.login(email: "ana@mail.com", password: "incorrecta")
        ) { error in
            XCTAssertEqual(error as? APIError, .unauthorized)
        }

        let access = await tokenStore.accessToken
        let status = await authState.status
        XCTAssertNil(access)
        XCTAssertEqual(status, .signedOut)
    }

    func testLogoutClearsTheLocalSessionEvenIfTheBackendFails() async {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 200, json: self.authResponseJSON)
        }
        try? await repository.login(email: "ana@mail.com", password: "12345678")
        MockURLProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }

        await repository.logout()

        let access = await tokenStore.accessToken
        let refresh = await tokenStore.refreshToken
        let status = await authState.status
        XCTAssertNil(access)
        XCTAssertNil(refresh)
        XCTAssertEqual(status, .signedOut)
    }
}

// swiftlint:enable force_unwrapping
