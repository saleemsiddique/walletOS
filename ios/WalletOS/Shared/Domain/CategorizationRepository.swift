protocol CategorizationRepository {
    /// `POST /categorize` — sugiere una categoría para la nota (auto-categorización IA).
    func suggestCategory(note: String, kind: TransactionCategory.Kind) async throws -> CategorizationSuggestion
}
