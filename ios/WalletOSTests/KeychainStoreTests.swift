import XCTest

@testable import WalletOS

final class KeychainStoreTests: XCTestCase {
    private var store: KeychainStore!
    private let account = "token"

    override func setUp() {
        super.setUp()
        // Servicio único por ejecución para aislar del Keychain compartido del simulador.
        store = KeychainStore(service: "com.walletOS.tests.\(UUID().uuidString)")
    }

    override func tearDown() {
        try? store.removeValue(for: account)
        store = nil
        super.tearDown()
    }

    func testSavesAndReadsBackTheValue() throws {
        try store.set("secret", for: account)
        XCTAssertEqual(try store.value(for: account), "secret")
    }

    func testOverwritingUpdatesInPlaceWithoutDuplicating() throws {
        try store.set("first", for: account)
        try store.set("second", for: account)
        XCTAssertEqual(try store.value(for: account), "second")
    }

    func testMissingValueReturnsNil() throws {
        XCTAssertNil(try store.value(for: "does-not-exist"))
    }

    func testRemoveDeletesTheValue() throws {
        try store.set("secret", for: account)
        try store.removeValue(for: account)
        XCTAssertNil(try store.value(for: account))
    }
}
