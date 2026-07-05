/// Caso de uso: categorías del tipo dado para la grid del modal.
struct FetchCategories {
    private let repository: CategoryRepository

    init(repository: CategoryRepository) {
        self.repository = repository
    }

    func execute(kind: TransactionCategory.Kind) async throws -> [TransactionCategory] {
        try await repository.fetchCategories(kind: kind)
    }
}
