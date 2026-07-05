import Foundation

/// Wallet plano con su banco ya resuelto (`GET /wallets`), para los selectores cross-bank del modal
/// de transacción. `icon` es el emoji del backend; la UI lo traduce con `IconCatalog`.
struct WalletSummary: Identifiable, Equatable {
    let id: String
    let bankName: String
    let name: String
    let icon: String
    let color: String
    let balance: Decimal
}
