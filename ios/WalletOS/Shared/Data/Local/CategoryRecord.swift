import GRDB

/// Espejo local de una categoría (cache de `GET /categories`).
struct CategoryRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "category"

    var id: String
    var name: String
    var icon: String
    var type: String
    var isCustom: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, icon, type
        case isCustom = "is_custom"
    }
}
