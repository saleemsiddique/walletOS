final class CategoryRepositoryImpl: CategoryRepository {
    private let remote: WalletCatalogRemoteDataSource

    init(remote: WalletCatalogRemoteDataSource) {
        self.remote = remote
    }

    func fetchCategories(kind: TransactionCategory.Kind) async throws -> [TransactionCategory] {
        try await remote.fetchCategories(type: kind.rawValue).categories.map { $0.toDomain() }
    }
}
