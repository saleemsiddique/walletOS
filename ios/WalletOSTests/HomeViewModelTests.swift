import XCTest

@testable import WalletOS

private final class DashboardRepositoryStub: DashboardRepository, @unchecked Sendable {
    var result: DashboardSnapshot?
    var error: Error?

    func fetchDashboard() async throws -> DashboardSnapshot {
        if let error { throw error }
        return result
            ?? DashboardSnapshot(
                totalBalance: 0, monthExpense: 0, monthExpenseChangePct: 0, recentTransactions: [],
                isFromCache: false, cachedAt: nil)
    }
}

private final class BankRepositoryStub: BankRepository, @unchecked Sendable {
    var banks: [Bank] = []
    var error: Error?

    func fetchBanks() async throws -> [Bank] {
        if let error { throw error }
        return banks
    }

    func createBank(name: String, icon: String?, color: String) async throws -> Bank {
        Bank(id: "bank", name: name, icon: icon ?? "🏦", color: color, wallets: [], totalBalance: 0)
    }
}

private final class TransactionRepositoryStub: TransactionRepository, @unchecked Sendable {
    private(set) var deletedIds: [String] = []
    var error: Error?

    func createTransfer(
        fromWalletID: String, toWalletID: String, amount: Decimal, note: String?, date: String
    ) async throws {}

    func delete(id: String) async throws {
        if let error { throw error }
        deletedIds.append(id)
    }
}

@MainActor
final class HomeViewModelTests: XCTestCase {
    private var dashboardRepository: DashboardRepositoryStub!
    private var bankRepository: BankRepositoryStub!
    private var transactionRepository: TransactionRepositoryStub!

    private func makeViewModel() -> HomeViewModel {
        HomeViewModel(
            fetchDashboard: FetchDashboard(repository: dashboardRepository),
            bankRepository: bankRepository,
            deleteTransaction: DeleteTransaction(repository: transactionRepository)
        )
    }

    private func makeTransaction(id: String = "t1", kind: DashboardTransaction.Kind = .expense) -> DashboardTransaction
    {
        DashboardTransaction(
            id: id, walletName: "Nómina", bankName: "Santander", kind: kind, amount: 42.3,
            categoryName: "Comida", categoryIcon: "🍔", note: "Mercadona", date: "2026-04-18",
            transferId: nil, pairedWalletName: nil
        )
    }

    override func setUp() {
        super.setUp()
        dashboardRepository = DashboardRepositoryStub()
        bankRepository = BankRepositoryStub()
        transactionRepository = TransactionRepositoryStub()
    }

    override func tearDown() {
        dashboardRepository = nil
        bankRepository = nil
        transactionRepository = nil
        super.tearDown()
    }

    func testLoadSucceedsPopulatesStateAndTransactions() async {
        let transaction = makeTransaction()
        dashboardRepository.result = DashboardSnapshot(
            totalBalance: 1000, monthExpense: 200, monthExpenseChangePct: 12.3,
            recentTransactions: [transaction], isFromCache: false, cachedAt: nil)
        let viewModel = makeViewModel()

        await viewModel.load()

        XCTAssertEqual(
            viewModel.state,
            .loaded(
                totalBalance: 1000, monthExpense: 200, monthExpenseChangePct: 12.3, isFromCache: false, cachedAt: nil))
        XCTAssertEqual(viewModel.transactions, [transaction])
    }

    func testLoadFailsSetsFailedState() async {
        dashboardRepository.error = APIError.server(status: 500)
        let viewModel = makeViewModel()

        await viewModel.load()

        XCTAssertEqual(viewModel.state, .failed)
    }

    func testWalletRowsAreFlattenedAndCappedAtThree() async {
        bankRepository.banks = [
            Bank(
                id: "bank-1", name: "Santander", icon: "🏦", color: "#E31837",
                wallets: [
                    Wallet(id: "w1", bankID: "bank-1", name: "Ahorro", icon: "💰", color: "#34C759", balance: 100),
                    Wallet(id: "w2", bankID: "bank-1", name: "Nómina", icon: "💳", color: "#007AFF", balance: 200),
                ],
                totalBalance: 300),
            Bank(
                id: "bank-2", name: "N26", icon: "🏦", color: "#000000",
                wallets: [
                    Wallet(id: "w3", bankID: "bank-2", name: "Corriente", icon: "💳", color: "#000000", balance: 50),
                    Wallet(id: "w4", bankID: "bank-2", name: "Conjunta", icon: "👥", color: "#000000", balance: 80),
                ],
                totalBalance: 130),
        ]
        let viewModel = makeViewModel()

        await viewModel.load()

        XCTAssertEqual(viewModel.walletRows.count, 3, "recorta a 3 filas fijas (regla §7.3)")
        XCTAssertEqual(viewModel.walletRows.map(\.id), ["w1", "w2", "w3"])
    }

    func testToggleBalanceRedactedFlipsTheFlag() {
        let viewModel = makeViewModel()
        XCTAssertFalse(viewModel.isBalanceRedacted)

        viewModel.toggleBalanceRedacted()

        XCTAssertTrue(viewModel.isBalanceRedacted)
    }

    func testRequestDeleteRemovesTransactionOptimisticallyThenConfirmsAfterDelay() async {
        let transaction = makeTransaction()
        dashboardRepository.result = DashboardSnapshot(
            totalBalance: 0, monthExpense: 0, monthExpenseChangePct: 0,
            recentTransactions: [transaction], isFromCache: false, cachedAt: nil)
        let viewModel = makeViewModel()
        await viewModel.load()

        viewModel.requestDelete(transaction)

        XCTAssertTrue(viewModel.transactions.isEmpty, "se quita al instante, de forma optimista")
        XCTAssertEqual(viewModel.pendingUndo, transaction)

        try? await Task.sleep(nanoseconds: 3_200_000_000)

        XCTAssertNil(viewModel.pendingUndo)
        XCTAssertEqual(transactionRepository.deletedIds, [transaction.id])
    }

    func testUndoDeleteRestoresTheTransactionAndCancelsTheDelete() async {
        let transaction = makeTransaction()
        dashboardRepository.result = DashboardSnapshot(
            totalBalance: 0, monthExpense: 0, monthExpenseChangePct: 0,
            recentTransactions: [transaction], isFromCache: false, cachedAt: nil)
        let viewModel = makeViewModel()
        await viewModel.load()

        viewModel.requestDelete(transaction)
        viewModel.undoDelete()

        XCTAssertEqual(viewModel.transactions, [transaction])
        XCTAssertNil(viewModel.pendingUndo)

        try? await Task.sleep(nanoseconds: 3_200_000_000)

        XCTAssertTrue(transactionRepository.deletedIds.isEmpty, "deshacer cancela el DELETE")
    }
}
