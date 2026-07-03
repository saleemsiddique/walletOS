import Foundation

/// Almacén seguro de secretos por cuenta. Abstracción sobre el Keychain para que `TokenStore`
/// sea testeable con una implementación en memoria.
protocol SecureStoring: Sendable {
    func set(_ value: String, for account: String) throws
    func value(for account: String) throws -> String?
    func removeValue(for account: String) throws
}
