import Foundation

/// Modelo de lectura de `GET /dashboard`: patrimonio total, gasto del mes con su variación y las
/// últimas transacciones. `isFromCache`/`cachedAt` los añade la Rama 15 (cache offline).
struct DashboardSnapshot: Equatable {
    let totalBalance: Decimal
    let monthExpense: Decimal
    let monthExpenseChangePct: Decimal
    let recentTransactions: [DashboardTransaction]
    let isFromCache: Bool
    let cachedAt: Date?
}
