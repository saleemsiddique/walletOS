import Foundation

/// Banco del usuario con sus wallets y el balance agregado (modelo de lectura de `GET /banks`).
/// Un banco recién creado (`POST /banks`) llega sin wallets: `wallets` vacío y `totalBalance` cero.
struct Bank: Identifiable, Equatable {
    let id: String
    let name: String
    /// Emoji tal cual lo guarda el backend; la UI lo traduce a SF Symbol con `IconCatalog`.
    let icon: String
    let color: String
    let wallets: [Wallet]
    let totalBalance: Decimal
}
