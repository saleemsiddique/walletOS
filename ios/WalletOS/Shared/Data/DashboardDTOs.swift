import Foundation

/// Respuesta de `GET /dashboard` (`docs/api-contracts.md`): agregados de patrimonio y las últimas
/// 10 transacciones. `date`/`createdAt` viajan como `String` (no `Date`): `date` es solo
/// año-mes-día, incompatible con el `dateDecodingStrategy` ISO-8601 del `APIClient`.
struct DashboardResponseDTO: Decodable {
    let totalBalance: Decimal
    let monthExpense: Decimal
    let monthExpenseChangePct: Decimal
    let recentTransactions: [DashboardTransactionDTO]
}

struct DashboardTransactionDTO: Decodable {
    let id: String
    let walletId: String
    let walletName: String
    let bankName: String
    let type: String
    let amount: Decimal
    let category: DashboardCategoryDTO?
    let note: String?
    let date: String
    let transferId: String?
    let pairedWalletName: String?
    let createdAt: String
}

struct DashboardCategoryDTO: Decodable {
    let id: String
    let name: String
    let icon: String
}
