import Foundation

@MainActor
final class TransactionModalViewModel: ObservableObject {
    @Published var mode: TransactionMode = .expense {
        didSet { modeDidChange() }
    }
    @Published var amount: Decimal = 0
    @Published var note = "" {
        didSet { noteDidChange() }
    }
    @Published var selectedCategoryId: String?
    @Published var selectedWalletId: String?
    @Published var destinationWalletId: String?
    @Published private(set) var wallets: [WalletSummary] = []
    @Published private(set) var categories: [TransactionCategory] = []
    @Published private(set) var isSaving = false
    @Published private(set) var errorMessage: String?

    private let createTransaction: CreateTransaction
    private let createTransfer: CreateTransfer
    private let fetchWallets: FetchWalletsForPicker
    private let fetchCategories: FetchCategories
    private let suggestCategory: SuggestCategory
    private let onSaved: () -> Void
    private let now: () -> Date
    private var categorizeTask: Task<Void, Never>?

    /// Debounce de la auto-categorización (design/api: 500 ms tras dejar de escribir).
    private let categorizeDebounce: Duration

    init(
        createTransaction: CreateTransaction,
        createTransfer: CreateTransfer,
        fetchWallets: FetchWalletsForPicker,
        fetchCategories: FetchCategories,
        suggestCategory: SuggestCategory,
        onSaved: @escaping () -> Void,
        now: @escaping () -> Date = Date.init,
        categorizeDebounce: Duration = .milliseconds(500)
    ) {
        self.createTransaction = createTransaction
        self.createTransfer = createTransfer
        self.fetchWallets = fetchWallets
        self.fetchCategories = fetchCategories
        self.suggestCategory = suggestCategory
        self.onSaved = onSaved
        self.now = now
        self.categorizeDebounce = categorizeDebounce
    }

    var canSave: Bool {
        guard amount > 0, !isSaving else { return false }
        switch mode {
        case .expense, .income:
            return selectedWalletId != nil
        case .transfer:
            guard let source = selectedWalletId, let destination = destinationWalletId else { return false }
            return source != destination
        }
    }

    func load() async {
        if let wallets = try? await fetchWallets.execute() {
            self.wallets = wallets
            if selectedWalletId == nil { selectedWalletId = wallets.first?.id }
        }
        await loadCategories()
    }

    func save() async {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil
        do {
            try await performSave()
            Haptics.success()
            onSaved()
        } catch {
            errorMessage = "No pudimos guardar. Inténtalo de nuevo."
        }
        isSaving = false
    }

    private func performSave() async throws {
        let date = Self.dateFormatter.string(from: now())
        switch mode {
        case .expense, .income:
            guard let walletID = selectedWalletId, let type = mode.apiType else { return }
            try await createTransaction.execute(
                walletID: walletID, type: type, amount: amount,
                categoryId: selectedCategoryId, note: normalizedNote, date: date)
        case .transfer:
            guard let source = selectedWalletId, let destination = destinationWalletId else { return }
            try await createTransfer.execute(
                fromWalletID: source, toWalletID: destination, amount: amount,
                note: normalizedNote, date: date)
        }
    }

    private var normalizedNote: String? {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func modeDidChange() {
        selectedCategoryId = nil
        Task { await loadCategories() }
    }

    private func loadCategories() async {
        guard mode != .transfer else {
            categories = []
            return
        }
        if let categories = try? await fetchCategories.execute(kind: mode.categoryKind) {
            self.categories = categories
        }
    }

    /// Debounce de la nota: espera 500 ms tras la última tecla y pide sugerencia; solo preselecciona
    /// si el backend devolvió una categoría con confianza suficiente y el usuario no eligió otra.
    private func noteDidChange() {
        categorizeTask?.cancel()
        guard mode != .transfer, let note = normalizedNote else { return }
        categorizeTask = Task {
            try? await Task.sleep(for: categorizeDebounce)
            guard !Task.isCancelled else { return }
            guard let suggestion = try? await suggestCategory.execute(note: note, kind: mode.categoryKind),
                suggestion.hasConfidentMatch
            else { return }
            if selectedCategoryId == nil {
                selectedCategoryId = suggestion.categoryId
            }
        }
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
}
