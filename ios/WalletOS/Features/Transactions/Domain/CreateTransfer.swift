import Foundation

/// Caso de uso: transferir entre wallets (`POST /transfers`). Directo, no offline-first.
struct CreateTransfer {
    private let repository: TransactionRepository

    init(repository: TransactionRepository) {
        self.repository = repository
    }

    func execute(
        fromWalletID: String,
        toWalletID: String,
        amount: Decimal,
        note: String?,
        date: String
    ) async throws {
        try await repository.createTransfer(
            fromWalletID: fromWalletID, toWalletID: toWalletID, amount: amount, note: note, date: date)
    }
}
