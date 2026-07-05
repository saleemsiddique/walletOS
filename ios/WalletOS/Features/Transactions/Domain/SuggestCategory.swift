/// Caso de uso: sugerir categoría para una nota (auto-categorización IA, `POST /categorize`).
struct SuggestCategory {
    private let repository: CategorizationRepository

    init(repository: CategorizationRepository) {
        self.repository = repository
    }

    func execute(note: String, kind: TransactionCategory.Kind) async throws -> CategorizationSuggestion {
        try await repository.suggestCategory(note: note, kind: kind)
    }
}
