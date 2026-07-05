import SwiftUI

/// Patrimonio (Rama 15): el dashboard principal. Hero = patrimonio total (tap → `••••••`
/// redacted), debajo el gasto del mes con su variación y las últimas transacciones.
struct HomeView: View {
    @StateObject private var viewModel: HomeViewModel

    init(viewModel: @autoclosure @escaping () -> HomeViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                switch viewModel.state {
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, Spacing.xxl)
                case .loaded(let snapshot):
                    content(for: snapshot)
                case .failed:
                    failedState
                }
            }
            .padding(Spacing.screenMargin)
        }
        .background(AppColor.bg)
        .tint(AppColor.accent)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private func content(for snapshot: DashboardSnapshot) -> some View {
        hero(snapshot)
        recentTransactions(snapshot.recentTransactions)
    }

    private func hero(_ snapshot: DashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            fieldLabel("PATRIMONIO")
            Button {
                viewModel.toggleBalanceRedacted()
            } label: {
                Text(
                    viewModel.isBalanceRedacted
                        ? "••••••" : CurrencyFormatter.eur(snapshot.totalBalance)
                )
                .font(Typography.hero)
                .foregroundStyle(AppColor.ink)
                .contentTransition(.numericText())
            }
            .buttonStyle(.plain)

            Text(monthExpenseSummary(snapshot))
                .font(Typography.amount)
                .foregroundStyle(AppColor.inkSoft)
        }
    }

    private func monthExpenseSummary(_ snapshot: DashboardSnapshot) -> String {
        let arrow = snapshot.monthExpenseChangePct >= 0 ? "▲" : "▼"
        let pct = abs(snapshot.monthExpenseChangePct)
        let expense = CurrencyFormatter.eur(snapshot.monthExpense)
        return "\(expense) este mes · \(arrow) \(pct)%"
    }

    @ViewBuilder
    private func recentTransactions(_ transactions: [DashboardTransaction]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            fieldLabel("ÚLTIMAS TRANSACCIONES")
            if transactions.isEmpty {
                Text("Sin movimientos. Añade el primero.")
                    .font(Typography.body)
                    .foregroundStyle(AppColor.inkSoft)
            } else {
                VStack(spacing: 0) {
                    ForEach(transactions) { transaction in
                        TransactionRow(transaction: transaction)
                        if transaction.id != transactions.last?.id {
                            Rectangle()
                                .fill(AppColor.hairline)
                                .frame(height: 0.5)
                        }
                    }
                }
            }
        }
    }

    private var failedState: some View {
        VStack(spacing: Spacing.md) {
            Text("No pudimos cargar tu patrimonio.")
                .font(Typography.body)
                .foregroundStyle(AppColor.ink)
            Button("Reintentar") {
                Task { await viewModel.load() }
            }
            .font(Typography.headline)
            .foregroundStyle(AppColor.accent)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.xxl)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(Typography.caption)
            .kerning(0.8)
            .foregroundStyle(AppColor.inkSoft)
    }
}

private struct TransactionRow: View {
    let transaction: DashboardTransaction

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.sm) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .light))
                .foregroundStyle(AppColor.inkSoft)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(Typography.body)
                    .foregroundStyle(AppColor.ink)
                Text(meta)
                    .font(Typography.caption)
                    .foregroundStyle(AppColor.inkSoft)
            }
            Spacer()
            Text(amountText)
                .font(Typography.amount)
                .foregroundStyle(transaction.kind == .income ? AppColor.income : AppColor.ink)
        }
        .padding(.vertical, Spacing.xs)
    }

    private var isTransfer: Bool { transaction.transferId != nil }

    private var symbol: String {
        if isTransfer { return "arrow.left.arrow.right" }
        guard let icon = transaction.categoryIcon else {
            return IconCatalog.FallbackContext.category.symbol
        }
        return IconCatalog.symbol(forEmoji: icon, fallback: .category)
    }

    private var title: String {
        if isTransfer { return "Transferencia" }
        return transaction.note ?? transaction.categoryName ?? transaction.walletName
    }

    private var meta: String {
        if isTransfer, let pairedWalletName = transaction.pairedWalletName {
            return "\(transaction.date) · \(transaction.walletName) → \(pairedWalletName)"
        }
        return "\(transaction.date) · \(transaction.categoryName ?? transaction.walletName)"
    }

    private var amountText: String {
        let sign = transaction.kind == .income ? "+" : "−"
        return "\(sign)\(CurrencyFormatter.eur(transaction.amount))"
    }
}
