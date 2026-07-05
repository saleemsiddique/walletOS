import Foundation

/// Contenido serializado de una operación `createTransaction` en la `SyncQueue`: el wallet destino
/// y el cuerpo de `POST /wallets/:id/transactions` (con el UUID de cliente que da idempotencia).
struct TransactionSyncPayload: Codable {
    let walletID: String
    let request: CreateTransactionRequestDTO
}
