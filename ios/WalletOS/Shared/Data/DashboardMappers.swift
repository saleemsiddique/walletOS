import Foundation

extension DashboardResponseDTO {
    func toDomain() -> DashboardSnapshot {
        DashboardSnapshot(
            totalBalance: totalBalance,
            monthExpense: monthExpense,
            monthExpenseChangePct: monthExpenseChangePct,
            recentTransactions: recentTransactions.map { $0.toDomain() },
            isFromCache: false,
            cachedAt: nil
        )
    }
}

extension DashboardTransactionDTO {
    func toDomain() -> DashboardTransaction {
        DashboardTransaction(
            id: id,
            walletName: walletName,
            bankName: bankName,
            kind: DashboardTransaction.Kind(rawValue: type) ?? .expense,
            amount: amount,
            categoryName: category?.name,
            categoryIcon: category?.icon,
            note: note,
            date: date,
            transferId: transferId,
            pairedWalletName: pairedWalletName
        )
    }
}
