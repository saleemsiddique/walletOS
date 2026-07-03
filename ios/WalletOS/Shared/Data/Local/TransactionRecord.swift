import GRDB

/// Espejo local de una transacción, con `id` de cliente (UUID) como PK — la misma idempotencia que
/// usa `POST /wallets/:id/transactions` (ver `SyncQueue`, Rama 7).
struct TransactionRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "transaction"

    var id: String
    var walletId: String
    var type: String
    var amount: Double
    var categoryId: String?
    var note: String?
    var date: String
    var transferId: String?
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, amount, note, date
        case walletId = "wallet_id"
        case categoryId = "category_id"
        case transferId = "transfer_id"
        case createdAt = "created_at"
    }
}
