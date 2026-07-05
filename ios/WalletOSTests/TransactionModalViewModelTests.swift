import XCTest

@testable import WalletOS

private final class WalletRepositoryStub: WalletRepository, @unchecked Sendable {
    var wallets: [WalletSummary] = []

    func createWallet(bankID: String, name: String, initialBalance: Decimal, color: String) async throws -> Wallet {
        Wallet(id: "w", bankID: bankID, name: name, icon: "💳", color: color, balance: initialBalance)
    }

    func fetchWallets() async throws -> [WalletSummary] { wallets }
}

private final class CategoryRepositoryStub: CategoryRepository, @unchecked Sendable {
    var categories: [TransactionCategory] = []
    func fetchCategories(kind: TransactionCategory.Kind) async throws -> [TransactionCategory] { categories }
}

private final class CategorizationRepositoryStub: CategorizationRepository, @unchecked Sendable {
    var suggestion = CategorizationSuggestion(
        categoryId: nil, categoryName: nil, categoryIcon: nil, confidence: 0)
    private(set) var callCount = 0

    func suggestCategory(note: String, kind: TransactionCategory.Kind) async throws -> CategorizationSuggestion {
        callCount += 1
        return suggestion
    }
}

@MainActor
final class TransactionModalViewModelTests: XCTestCase {
    private var wallets: WalletRepositoryStub!
    private var categories: CategoryRepositoryStub!
    private var categorization: CategorizationRepositoryStub!
    private var database: AppDatabase!
    private var syncQueue: SyncQueue!
    private var transferRepository: TransactionRepositoryStub!
    private var didSave = false

    // swiftlint:disable:next force_try
    private func makeViewModel() -> TransactionModalViewModel {
        TransactionModalViewModel(
            createTransaction: CreateTransaction(syncQueue: syncQueue),
            createTransfer: CreateTransfer(repository: transferRepository),
            fetchWallets: FetchWalletsForPicker(repository: wallets),
            fetchCategories: FetchCategories(repository: categories),
            suggestCategory: SuggestCategory(repository: categorization),
            onSaved: { self.didSave = true },
            now: { Date(timeIntervalSince1970: 1_776_000_000) },
            categorizeDebounce: .milliseconds(10)
        )
    }

    override func setUp() {
        super.setUp()
        // swiftlint:disable:next force_try
        database = try! AppDatabase.openInMemory()
        wallets = WalletRepositoryStub()
        categories = CategoryRepositoryStub()
        categorization = CategorizationRepositoryStub()
        transferRepository = TransactionRepositoryStub()
        syncQueue = SyncQueue(database: database, handler: RecordingSyncHandler())
        didSave = false
    }

    override func tearDown() {
        database = nil
        wallets = nil
        categories = nil
        categorization = nil
        transferRepository = nil
        syncQueue = nil
        super.tearDown()
    }

    func testLoadPreselectsFirstWalletAndLoadsCategories() async {
        wallets.wallets = [
            WalletSummary(id: "w1", bankName: "Santander", name: "Nómina", icon: "💳", color: "#000", balance: 100),
            WalletSummary(id: "w2", bankName: "N26", name: "Ahorro", icon: "💰", color: "#000", balance: 50),
        ]
        categories.categories = [
            TransactionCategory(id: "c1", name: "Comida", icon: "🍔", kind: .expense, isCustom: false)
        ]
        let viewModel = makeViewModel()

        await viewModel.load()

        XCTAssertEqual(viewModel.selectedWalletId, "w1")
        XCTAssertEqual(viewModel.categories.count, 1)
    }

    func testCannotSaveWithoutAmountOrWallet() async {
        let viewModel = makeViewModel()
        XCTAssertFalse(viewModel.canSave, "sin importe ni wallet no se puede guardar")

        viewModel.amount = 10
        XCTAssertFalse(viewModel.canSave, "sin wallet seleccionado tampoco")
    }

    func testTransferRequiresDistinctWallets() async {
        wallets.wallets = [
            WalletSummary(id: "w1", bankName: "Santander", name: "Nómina", icon: "💳", color: "#000", balance: 100),
            WalletSummary(id: "w2", bankName: "N26", name: "Ahorro", icon: "💰", color: "#000", balance: 50),
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.mode = .transfer
        viewModel.amount = 25
        viewModel.selectedWalletId = "w1"
        viewModel.destinationWalletId = "w1"
        XCTAssertFalse(viewModel.canSave, "origen y destino iguales no valen")

        viewModel.destinationWalletId = "w2"
        XCTAssertTrue(viewModel.canSave)
    }

    func testSaveExpenseEnqueuesTransactionAndCallsOnSaved() async {
        wallets.wallets = [
            WalletSummary(id: "w1", bankName: "Santander", name: "Nómina", icon: "💳", color: "#000", balance: 100)
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.amount = 42.3

        await viewModel.save()

        let pending = try? await syncQueue.fetchAll()
        XCTAssertEqual(pending?.count, 1, "el gasto se encola en la SyncQueue")
        XCTAssertEqual(pending?.first?.type, .createTransaction)
        XCTAssertTrue(didSave)
    }

    func testSaveTransferCallsTransferRepository() async {
        wallets.wallets = [
            WalletSummary(id: "w1", bankName: "Santander", name: "Nómina", icon: "💳", color: "#000", balance: 100),
            WalletSummary(id: "w2", bankName: "N26", name: "Ahorro", icon: "💰", color: "#000", balance: 50),
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.mode = .transfer
        viewModel.amount = 30
        viewModel.selectedWalletId = "w1"
        viewModel.destinationWalletId = "w2"

        await viewModel.save()

        XCTAssertEqual(transferRepository.transfers.count, 1)
        XCTAssertEqual(transferRepository.transfers.first?.from, "w1")
        XCTAssertEqual(transferRepository.transfers.first?.to, "w2")
        XCTAssertTrue(didSave)
    }

    func testConfidentSuggestionPreselectsCategory() async {
        categorization.suggestion = CategorizationSuggestion(
            categoryId: "c1", categoryName: "Comida", categoryIcon: "🍔", confidence: 0.92)
        let viewModel = makeViewModel()

        viewModel.note = "Mercadona"

        try? await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertEqual(viewModel.selectedCategoryId, "c1", "confianza alta preselecciona")
    }

    func testWeakSuggestionDoesNotPreselectCategory() async {
        categorization.suggestion = CategorizationSuggestion(
            categoryId: nil, categoryName: nil, categoryIcon: nil, confidence: 0.31)
        let viewModel = makeViewModel()

        viewModel.note = "algo raro"

        try? await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertNil(viewModel.selectedCategoryId, "confianza baja no preselecciona")
    }

    // MARK: - Edición (Rama 17)

    private func makeEditViewModel(
        transactionId: String, onDelete: @escaping () -> Void = {}
    )
        -> TransactionModalViewModel
    {
        TransactionModalViewModel(
            createTransaction: CreateTransaction(syncQueue: syncQueue),
            createTransfer: CreateTransfer(repository: transferRepository),
            fetchWallets: FetchWalletsForPicker(repository: wallets),
            fetchCategories: FetchCategories(repository: categories),
            suggestCategory: SuggestCategory(repository: categorization),
            editing: TransactionModalViewModel.EditingDependencies(
                transactionId: transactionId,
                fetchTransaction: FetchTransaction(repository: transferRepository),
                updateTransaction: UpdateTransaction(repository: transferRepository),
                onDelete: onDelete
            ),
            onSaved: { self.didSave = true },
            now: { Date(timeIntervalSince1970: 1_776_000_000) },
            categorizeDebounce: .milliseconds(10)
        )
    }

    func testLoadInEditModePreloadsFieldsFromTheTransaction() async {
        wallets.wallets = [
            WalletSummary(id: "w1", bankName: "Santander", name: "Nómina", icon: "💳", color: "#000", balance: 100)
        ]
        transferRepository.editable = EditableTransaction(
            id: "tx-1", walletId: "w1", type: "INCOME", amount: 75.5, categoryId: "c9", note: "Regalo",
            date: "2026-03-01", transferId: nil)
        let viewModel = makeEditViewModel(transactionId: "tx-1")

        await viewModel.load()

        XCTAssertTrue(viewModel.isEditing)
        XCTAssertEqual(viewModel.mode, .income)
        XCTAssertEqual(viewModel.amount, 75.5)
        XCTAssertEqual(viewModel.note, "Regalo")
        XCTAssertEqual(viewModel.selectedWalletId, "w1")
        XCTAssertEqual(viewModel.selectedCategoryId, "c9")
    }

    func testSaveInEditModeUpdatesInsteadOfCreating() async {
        transferRepository.editable = EditableTransaction(
            id: "tx-1", walletId: "w1", type: "EXPENSE", amount: 20, categoryId: nil, note: nil,
            date: "2026-03-01", transferId: nil)
        let viewModel = makeEditViewModel(transactionId: "tx-1")
        await viewModel.load()
        viewModel.amount = 33

        await viewModel.save()

        XCTAssertEqual(transferRepository.updates.count, 1, "editar hace PATCH, no crea")
        XCTAssertEqual(transferRepository.updates.first?.id, "tx-1")
        XCTAssertEqual(transferRepository.updates.first?.amount, 33)
        let queued = try? await syncQueue.fetchAll()
        XCTAssertEqual(queued?.count, 0, "editar no encola una creación")
        XCTAssertTrue(didSave)
    }

    func testRequestDeleteInvokesTheDeleteCallback() async {
        var didDelete = false
        let viewModel = makeEditViewModel(transactionId: "tx-1", onDelete: { didDelete = true })

        viewModel.requestDelete()

        XCTAssertTrue(didDelete)
    }
}

/// Stub de `TransactionRepository` que registra transferencias, ediciones y la transacción a
/// precargar en modo edición.
private final class TransactionRepositoryStub: TransactionRepository, @unchecked Sendable {
    struct Transfer {
        let from: String
        let to: String
    }
    struct Update {
        let id: String
        let type: String
        let amount: Decimal
        let categoryId: String?
    }
    private(set) var transfers: [Transfer] = []
    private(set) var updates: [Update] = []
    var editable: EditableTransaction?

    func createTransfer(
        fromWalletID: String, toWalletID: String, amount: Decimal, note: String?, date: String
    ) async throws {
        transfers.append(Transfer(from: fromWalletID, to: toWalletID))
    }

    func fetch(id: String) async throws -> EditableTransaction {
        editable
            ?? EditableTransaction(
                id: id, walletId: "w1", type: "EXPENSE", amount: 10, categoryId: nil, note: nil,
                date: "2026-04-18", transferId: nil)
    }

    func update(
        id: String, type: String, amount: Decimal, categoryId: String?, note: String?, date: String
    ) async throws {
        updates.append(Update(id: id, type: type, amount: amount, categoryId: categoryId))
    }

    func delete(id: String) async throws {}
}

/// Handler mínimo para construir una `SyncQueue` real en tests: no toca red.
private struct RecordingSyncHandler: SyncOperationHandling {
    func perform(_ operation: SyncOperation) async throws -> Data { Data() }
    func reconcile(operation: SyncOperation, remoteResponse: Data) async throws {}
}
