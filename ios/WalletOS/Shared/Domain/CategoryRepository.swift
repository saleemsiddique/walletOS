protocol CategoryRepository {
    /// `GET /categories?type=` — categorías del tipo dado (predefinidas primero, luego custom).
    func fetchCategories(kind: TransactionCategory.Kind) async throws -> [TransactionCategory]
}
