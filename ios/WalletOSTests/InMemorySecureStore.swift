import Foundation

@testable import WalletOS

/// Almacén seguro en memoria para tests (sin tocar el Keychain).
final class InMemorySecureStore: SecureStoring, @unchecked Sendable {
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
