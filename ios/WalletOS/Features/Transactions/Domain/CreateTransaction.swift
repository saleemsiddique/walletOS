import Foundation

/// Caso de uso: crear un gasto/ingreso offline-first. Genera el UUID de cliente, encola la
/// operación en la `SyncQueue` (queda `pending`) e intenta drenarla de inmediato; si no hay red,
/// se drenará sola al reconectar. `date` en formato `yyyy-MM-dd`.
struct CreateTransaction {
    private let syncQueue: SyncQueue

    init(syncQueue: SyncQueue) {
        self.syncQueue = syncQueue
    }

    func execute(
        walletID: String,
        type: String,
        amount: Decimal,
        categoryId: String?,
        note: String?,
        date: String
    ) async throws {
        let request = CreateTransactionRequestDTO(
            id: UUID().uuidString, type: type, amount: amount, categoryId: categoryId, note: note, date: date)
        let payload = try JSONEncoder().encode(TransactionSyncPayload(walletID: walletID, request: request))
        try await syncQueue.enqueue(type: .createTransaction, payload: payload)
        await syncQueue.drain()
    }
}
