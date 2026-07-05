import Foundation

/// Wallet dentro de un banco. `balance` lo calcula el backend (el cliente nunca lo recalcula).
/// `icon` es el emoji tal cual lo guarda el backend; la UI lo traduce a SF Symbol con `IconCatalog`.
struct Wallet: Identifiable, Equatable {
    let id: String
    let bankID: String
    let name: String
    let icon: String
    let color: String
    let balance: Decimal
}
