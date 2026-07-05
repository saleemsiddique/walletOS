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

    /// `GET /transactions/:id` — la transacción con sus ids, para precargar el modal en edición.
    func fetch(id: String) async throws -> EditableTransaction

    /// `PATCH /transactions/:id` — edita una transacción normal. El backend rechaza (403) las patas
    /// de transferencia; la UI ya las bloquea antes de llegar aquí.
    func update(
        id: String,
        type: String,
        amount: Decimal,
        categoryId: String?,
        note: String?,
        date: String
    ) async throws

    func delete(id: String) async throws
}
