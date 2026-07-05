import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case loaded(totalBalance: Decimal, monthExpense: Decimal, monthExpenseChangePct: Decimal)
        case failed
    }

    /// Filas mostradas en Patrimonio, recortadas a 3 (regla §7.3: lista plana, sin secciones).
    static let maxWalletRows = 3

    @Published private(set) var state: State = .loading
    @Published private(set) var transactions: [DashboardTransaction] = []
    @Published private(set) var walletRows: [HomeWalletRow] = []
    @Published var isBalanceRedacted = false
    /// Transacción borrada de forma optimista, con toast "Deshacer" 3s antes de confirmar el `DELETE`.
    @Published private(set) var pendingUndo: DashboardTransaction?

    private let fetchDashboard: FetchDashboard
    private let bankRepository: BankRepository
    private let deleteTransaction: DeleteTransaction
    private var pendingUndoIndex: Int?

    init(
        fetchDashboard: FetchDashboard,
        bankRepository: BankRepository,
        deleteTransaction: DeleteTransaction
    ) {
        self.fetchDashboard = fetchDashboard
        self.bankRepository = bankRepository
        self.deleteTransaction = deleteTransaction
    }

    func load() async {
        state = .loading
        do {
            let snapshot = try await fetchDashboard.execute()
            state = .loaded(
                totalBalance: snapshot.totalBalance,
                monthExpense: snapshot.monthExpense,
                monthExpenseChangePct: snapshot.monthExpenseChangePct
            )
            transactions = snapshot.recentTransactions
        } catch {
            state = .failed
        }

        if let banks = try? await bankRepository.fetchBanks() {
            walletRows = Array(banks.flattenedWalletRows().prefix(Self.maxWalletRows))
        }
    }

    func toggleBalanceRedacted() {
        isBalanceRedacted.toggle()
    }

    /// Quita la transacción de la lista al instante y da 3s de margen para deshacer antes de
    /// confirmar el borrado contra el backend.
    func requestDelete(_ transaction: DashboardTransaction) {
        guard let index = transactions.firstIndex(where: { $0.id == transaction.id }) else { return }
        transactions.remove(at: index)
        pendingUndo = transaction
        pendingUndoIndex = index

        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard pendingUndo?.id == transaction.id else { return }
            pendingUndo = nil
            pendingUndoIndex = nil
            try? await deleteTransaction.execute(id: transaction.id)
        }
    }

    func undoDelete() {
        guard let transaction = pendingUndo, let index = pendingUndoIndex else { return }
        transactions.insert(transaction, at: min(index, transactions.count))
        pendingUndo = nil
        pendingUndoIndex = nil
    }
}
