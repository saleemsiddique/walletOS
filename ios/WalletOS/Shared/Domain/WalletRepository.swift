import Foundation

/// Acceso a wallets del wallet-service. En Setup solo se crean wallets `CASH`; los `INVESTMENT`
/// llegan con su propio flujo en una rama posterior.
protocol WalletRepository {
    /// `POST /banks/:bankID/wallets` — crea un wallet `CASH` en el banco y lo devuelve. Sin `icon`:
    /// los wallets no tienen selector de icono (es exclusivo de categorías), el backend aplica
    /// siempre su valor por defecto.
    func createWallet(
        bankID: String,
        name: String,
        initialBalance: Decimal,
        color: String
    ) async throws -> Wallet

    /// `GET /wallets` — lista plana con `bank_name` resuelto, para los selectores del modal.
    func fetchWallets() async throws -> [WalletSummary]
}
