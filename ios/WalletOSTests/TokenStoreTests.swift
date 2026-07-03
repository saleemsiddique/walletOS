import XCTest

@testable import WalletOS

/// Almacén seguro en memoria para tests (sin tocar el Keychain).
private final class InMemorySecureStore: SecureStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: String] = [:]

    func set(_ value: String, for account: String) throws {
        lock.lock()
        defer { lock.unlock() }
        storage[account] = value
    }

    func value(for account: String) throws -> String? {
        lock.lock()
        defer { lock.unlock() }
        return storage[account]
    }

    func removeValue(for account: String) throws {
        lock.lock()
        defer { lock.unlock() }
        storage[account] = nil
    }
}

final class TokenStoreTests: XCTestCase {
    private func makeStore() async -> (TokenStore, AuthState) {
        let authState = await AuthState()
        let store = TokenStore(secureStore: InMemorySecureStore(), authState: authState)
        return (store, authState)
    }

    func testSavingTokensPersistsThemAndSignsIn() async {
        let (store, authState) = await makeStore()
        await store.saveTokens(access: "a", refresh: "r")

        let access = await store.accessToken
        let refresh = await store.refreshToken
        let status = await authState.status
        XCTAssertEqual(access, "a")
        XCTAssertEqual(refresh, "r")
        XCTAssertEqual(status, .signedIn)
    }

    func testClearRemovesTokensAndSignsOut() async {
        let (store, authState) = await makeStore()
        await store.saveTokens(access: "a", refresh: "r")

        await store.clear()

        let access = await store.accessToken
        let refresh = await store.refreshToken
        let status = await authState.status
        XCTAssertNil(access)
        XCTAssertNil(refresh)
        XCTAssertEqual(status, .signedOut)
    }

    func testSavingAgainOverwritesTheExistingTokens() async {
        let (store, _) = await makeStore()
        await store.saveTokens(access: "a1", refresh: "r1")
        await store.saveTokens(access: "a2", refresh: "r2")

        let access = await store.accessToken
        let refresh = await store.refreshToken
        XCTAssertEqual(access, "a2")
        XCTAssertEqual(refresh, "r2")
    }

    func testRestoreSessionSignsInWhenARefreshTokenExists() async {
        let secureStore = InMemorySecureStore()
        try? secureStore.set("r", for: "refresh-token")
        let authState = await AuthState()
        let store = TokenStore(secureStore: secureStore, authState: authState)

        await store.restoreSession()

        let status = await authState.status
        XCTAssertEqual(status, .signedIn)
    }
}
