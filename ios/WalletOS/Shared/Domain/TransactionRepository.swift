import Foundation

protocol TransactionRepository {
    /// `POST /transfers` — mueve dinero entre wallets (crea las dos patas atómicamente). Directo,
    /// no offline-first: el `SyncOperationType` no cubre transferencias.
    func createTransfer(
        fromWalletID: String,
        toWalletID: String,
        amount: Decimal,
        note: String?,
        date: String
    ) async throws

    func delete(id: String) async throws
}
