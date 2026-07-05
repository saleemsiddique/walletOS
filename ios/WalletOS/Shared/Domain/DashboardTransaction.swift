import Foundation

/// Una fila de `recent_transactions` en `GET /dashboard`: ya trae el nombre de wallet/banco
/// resuelto por el backend, sin necesidad de cruzarla con `Bank`/`Wallet`.
struct DashboardTransaction: Identifiable, Equatable, Codable {
    enum Kind: String, Codable {
        case expense = "EXPENSE"
        case income = "INCOME"
    }

    let id: String
    let walletName: String
    let bankName: String
    let kind: Kind
    let amount: Decimal
    /// `nil` en transferencias (sin categoría) y en gastos/ingresos sin categorizar.
    let categoryName: String?
    let categoryIcon: String?
    let note: String?
    let date: String
    /// `nil` para transacciones normales; presente en una pata de transferencia.
    let transferId: String?
    let pairedWalletName: String?
}
