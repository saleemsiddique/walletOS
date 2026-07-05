import SwiftUI

/// Patrimonio (Rama 15): el dashboard principal. Hero = patrimonio total (tap → `••••••`
/// redacted), gasto del mes con su variación, lista plana de wallets relevantes, últimas
/// transacciones (swipe→borrar con undo) y el botón único "＋ Añadir".
struct HomeView: View {
    @StateObject private var viewModel: HomeViewModel
    private let makeAccountsViewModel: () -> AccountsViewModel
    private let onAddTransaction: () -> Void

    init(
        viewModel: @autoclosure @escaping () -> HomeViewModel,
        makeAccountsViewModel: @escaping () -> AccountsViewModel,
        onAddTransaction: @escaping () -> Void = {}
    ) {
        _viewModel = StateObject(wrappedValue: viewModel())
        self.makeAccountsViewModel = makeAccountsViewModel
        self.onAddTransaction = onAddTransaction
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                switch viewModel.state {
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, Spacing.xxl)
                case .loaded(
                    let totalBalance, let monthExpense, let monthExpenseChangePct, let isFromCache,
                    let cachedAt):
                    if isFromCache {
                        offlineBanner(cachedAt: cachedAt)
                    }
                    hero(totalBalance: totalBalance, monthExpense: monthExpense, changePct: monthExpenseChangePct)
                    walletRows
                    recentTransactions
                    AddTransactionButton(action: onAddTransaction)
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
        .overlay(alignment: .bottom) {
            if let pendingUndo = viewModel.pendingUndo {
                undoToast(for: pendingUndo)
            }
        }
        .animation(Motion.standard, value: viewModel.pendingUndo)
    }

    private func offlineBanner(cachedAt: Date?) -> some View {
        Text(offlineBannerText(cachedAt: cachedAt))
            .font(Typography.caption)
            .foregroundStyle(AppColor.inkSoft)
    }

    private func offlineBannerText(cachedAt: Date?) -> String {
        guard let cachedAt else { return "Sin conexión — datos guardados" }
        let time = cachedAt.formatted(date: .omitted, time: .shortened)
        if Calendar.current.isDateInToday(cachedAt) {
            return "Sin conexión — datos de las \(time)"
        }
        let day = cachedAt.formatted(date: .abbreviated, time: .omitted)
        return "Sin conexión — datos del \(day) a las \(time)"
    }

    private func hero(totalBalance: Decimal, monthExpense: Decimal, changePct: Decimal) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            fieldLabel("PATRIMONIO")
            Button {
                viewModel.toggleBalanceRedacted()
            } label: {
                Text(viewModel.isBalanceRedacted ? "••••••" : CurrencyFormatter.eur(totalBalance))
                    .font(Typography.hero)
                    .foregroundStyle(AppColor.ink)
                    .contentTransition(.numericText())
            }
            .buttonStyle(.plain)

            Text(monthExpenseSummary(monthExpense: monthExpense, changePct: changePct))
                .font(Typography.amount)
                .foregroundStyle(AppColor.inkSoft)
        }
    }

    private func monthExpenseSummary(monthExpense: Decimal, changePct: Decimal) -> String {
        let arrow = changePct >= 0 ? "▲" : "▼"
        let pct = abs(changePct)
        return "\(CurrencyFormatter.eur(monthExpense)) este mes · \(arrow) \(pct)%"
    }

    @ViewBuilder
    private var walletRows: some View {
        if !viewModel.walletRows.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                fieldLabel("CARTERAS")
                VStack(spacing: 0) {
                    ForEach(viewModel.walletRows) { row in
                        HStack {
                            Text(row.bankName)
                                .font(Typography.body)
                                .foregroundStyle(AppColor.ink)
                            Spacer()
                            Text(CurrencyFormatter.eur(row.balance))
                                .font(Typography.amount)
                                .foregroundStyle(AppColor.ink)
                        }
                        .padding(.vertical, Spacing.xs)
                        if row.id != viewModel.walletRows.last?.id {
                            Rectangle().fill(AppColor.hairline).frame(height: 0.5)
                        }
                    }
                }
                NavigationLink("ver todas") {
                    AccountsView(viewModel: makeAccountsViewModel())
                }
                .font(Typography.caption)
                .foregroundStyle(AppColor.accent)
            }
        }
    }

    @ViewBuilder
    private var recentTransactions: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            fieldLabel("ÚLTIMAS TRANSACCIONES")
            if viewModel.transactions.isEmpty {
                Text("Sin movimientos. Añade el primero.")
                    .font(Typography.body)
                    .foregroundStyle(AppColor.inkSoft)
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.transactions) { transaction in
                        TransactionRow(transaction: transaction)
                            .swipeActions(edge: .trailing) {
                                Button("Borrar", role: .destructive) {
                                    viewModel.requestDelete(transaction)
                                }
                            }
                        if transaction.id != viewModel.transactions.last?.id {
                            Rectangle()
                                .fill(AppColor.hairline)
                                .frame(height: 0.5)
                        }
                    }
                }
            }
        }
    }

    private func undoToast(for transaction: DashboardTransaction) -> some View {
        HStack {
            Text("Transacción borrada")
                .font(Typography.body)
                .foregroundStyle(AppColor.onAccent)
            Spacer()
            Button("Deshacer") {
                viewModel.undoDelete()
            }
            .font(Typography.headline)
            .foregroundStyle(AppColor.onAccent)
        }
        .padding(Spacing.md)
        .background(AppColor.ink, in: RoundedRectangle(cornerRadius: Radius.container, style: .continuous))
        .padding(Spacing.screenMargin)
        .transition(.move(edge: .bottom).combined(with: .opacity))
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
