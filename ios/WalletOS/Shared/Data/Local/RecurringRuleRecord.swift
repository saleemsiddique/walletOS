import GRDB

/// Espejo local de una regla recurrente (cache de `GET /recurring`).
struct RecurringRuleRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "recurring_rule"

    var id: String
    var walletId: String
    var type: String
    var amount: Double
    var categoryId: String?
    var note: String?
    var frequency: String
    var dayOfMonth: Int?
    var dayOfWeek: Int?
    var nextRun: String
    var isActive: Bool
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, amount, note, frequency
        case walletId = "wallet_id"
        case categoryId = "category_id"
        case dayOfMonth = "day_of_month"
        case dayOfWeek = "day_of_week"
        case nextRun = "next_run"
        case isActive = "is_active"
        case createdAt = "created_at"
    }
}
