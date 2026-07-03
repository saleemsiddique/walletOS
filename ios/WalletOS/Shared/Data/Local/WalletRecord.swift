import GRDB

/// Espejo local de un wallet (cache de `GET /banks`, `GET /wallets`). `balance` es el valor
/// calculado que devuelve el backend; el cliente no lo recalcula.
struct WalletRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "wallet"

    var id: String
    var bankId: String
    var name: String
    var type: String
    var icon: String
    var color: String
    var balance: Double
    var isArchived: Bool
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, type, icon, color, balance
        case bankId = "bank_id"
        case isArchived = "is_archived"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
