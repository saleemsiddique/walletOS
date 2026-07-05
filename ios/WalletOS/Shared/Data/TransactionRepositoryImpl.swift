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

    func fetch(id: String) async throws -> EditableTransaction {
        try await remote.fetch(id: id).toEditable()
    }

    func update(
        id: String,
        type: String,
        amount: Decimal,
        categoryId: String?,
        note: String?,
        date: String
    ) async throws {
        _ = try await remote.update(
            id: id,
            request: UpdateTransactionRequestDTO(
                type: type, amount: amount, categoryId: categoryId, note: note, date: date))
    }

    func delete(id: String) async throws {
        try await remote.delete(id: id)
    }
}
