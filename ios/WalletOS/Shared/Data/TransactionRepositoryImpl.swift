import Foundation

final class TransactionRepositoryImpl: TransactionRepository {
    private let remote: TransactionRemoteDataSource

    init(remote: TransactionRemoteDataSource) {
        self.remote = remote
    }

    func createTransfer(
        fromWalletID: String,
        toWalletID: String,
        amount: Decimal,
        note: String?,
        date: String
    ) async throws {
        try await remote.createTransfer(
            request: CreateTransferRequestDTO(
                fromWalletId: fromWalletID, toWalletId: toWalletID, amount: amount, note: note, date: date))
    }

    func delete(id: String) async throws {
        try await remote.delete(id: id)
    }
}
