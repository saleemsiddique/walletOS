import Foundation
import GRDB

/// Espejo local del último `GET /dashboard` (tabla singleton, Rama 15). `recentTransactionsJson`
/// serializa `[DashboardTransaction]` — son datos denormalizados de solo lectura, sin
/// correspondencia 1:1 con las tablas `transaction`/`wallet`/`bank` existentes.
struct DashboardSnapshotRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "dashboard_snapshot"
    static let singletonId = "dashboard"

    var id: String
    var totalBalance: Double
    var monthExpense: Double
    var monthExpenseChangePct: Double
    var recentTransactionsJson: String
    var syncedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case totalBalance = "total_balance"
        case monthExpense = "month_expense"
        case monthExpenseChangePct = "month_expense_change_pct"
        case recentTransactionsJson = "recent_transactions_json"
        case syncedAt = "synced_at"
    }

    init(snapshot: DashboardSnapshot, syncedAt: Date) throws {
        id = Self.singletonId
        totalBalance = (snapshot.totalBalance as NSDecimalNumber).doubleValue
        monthExpense = (snapshot.monthExpense as NSDecimalNumber).doubleValue
        monthExpenseChangePct = (snapshot.monthExpenseChangePct as NSDecimalNumber).doubleValue
        recentTransactionsJson =
            String(
                data: try JSONEncoder().encode(snapshot.recentTransactions), encoding: .utf8) ?? "[]"
        self.syncedAt = ISO8601DateFormatter().string(from: syncedAt)
    }

    func toDomain() -> DashboardSnapshot? {
        guard let data = recentTransactionsJson.data(using: .utf8),
            let transactions = try? JSONDecoder().decode([DashboardTransaction].self, from: data),
            let cachedAt = ISO8601DateFormatter().date(from: syncedAt)
        else { return nil }

        return DashboardSnapshot(
            totalBalance: Decimal(totalBalance),
            monthExpense: Decimal(monthExpense),
            monthExpenseChangePct: Decimal(monthExpenseChangePct),
            recentTransactions: transactions,
            isFromCache: true,
            cachedAt: cachedAt
        )
    }
}
