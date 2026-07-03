import GRDB

/// Espejo local de un banco (cache de `GET /banks`). Los campos son 1:1 con `api-contracts.md`.
struct BankRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "bank"

    var id: String
    var name: String
    var icon: String
    var color: String
    var isArchived: Bool
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, icon, color
        case isArchived = "is_archived"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
