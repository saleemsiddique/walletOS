import Foundation

@MainActor
final class TransactionModalViewModel: ObservableObject {
    @Published var mode: TransactionMode = .expense {
        didSet { if !isPreloading { modeDidChange() } }
    }
    @Published var amount: Decimal = 0
    @Published var note = "" {
        didSet { if !isPreloading { noteDidChange() } }
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
    private let editing: EditingDependencies?
    private let onSaved: () -> Void
    private let now: () -> Date
    private var categorizeTask: Task<Void, Never>?
    private var isPreloading = false
    private var editingDate: String?

    /// Debounce de la auto-categorización (design/api: 500 ms tras dejar de escribir).
    private let categorizeDebounce: Duration

    /// Dependencias solo del modo edición: precargar (`GET`), guardar cambios (`PATCH`) y borrar
    /// (delega en el flujo de undo de Patrimonio). Ausentes en modo creación.
    struct EditingDependencies {
        let transactionId: String
        let fetchTransaction: FetchTransaction
        let updateTransaction: UpdateTransaction
        let onDelete: () -> Void
    }

    init(
        createTransaction: CreateTransaction,
        createTransfer: CreateTransfer,
        fetchWallets: FetchWalletsForPicker,
        fetchCategories: FetchCategories,
        suggestCategory: SuggestCategory,
        editing: EditingDependencies? = nil,
        onSaved: @escaping () -> Void,
        now: @escaping () -> Date = Date.init,
        categorizeDebounce: Duration = .milliseconds(500)
    ) {
        self.createTransaction = createTransaction
        self.createTransfer = createTransfer
        self.fetchWallets = fetchWallets
        self.fetchCategories = fetchCategories
        self.suggestCategory = suggestCategory
        self.editing = editing
        self.onSaved = onSaved
        self.now = now
        self.categorizeDebounce = categorizeDebounce
    }

    var isEditing: Bool { editing != nil }

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
        if let editing, let transaction = try? await editing.fetchTransaction.execute(id: editing.transactionId) {
            preload(transaction)
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

    /// Borrar desde el modal reusa el toast "Deshacer" de Patrimonio (no duplica el mecanismo).
    func requestDelete() {
        editing?.onDelete()
    }

    private func performSave() async throws {
        let date = editingDate ?? Self.dateFormatter.string(from: now())
        if let editing, let type = mode.apiType {
            try await editing.updateTransaction.execute(
                id: editing.transactionId, type: type, amount: amount,
                categoryId: selectedCategoryId, note: normalizedNote, date: date)
            return
        }
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

    /// Rellena los campos sin disparar la recarga de categorías ni la auto-categorización.
    private func preload(_ transaction: EditableTransaction) {
        isPreloading = true
        mode = transaction.type == "INCOME" ? .income : .expense
        amount = transaction.amount
        note = transaction.note ?? ""
        selectedWalletId = transaction.walletId
        selectedCategoryId = transaction.categoryId
        editingDate = transaction.date
        isPreloading = false
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
