final class CategorizationRepositoryImpl: CategorizationRepository {
    private let remote: WalletCatalogRemoteDataSource

    init(remote: WalletCatalogRemoteDataSource) {
        self.remote = remote
    }

    func suggestCategory(note: String, kind: TransactionCategory.Kind) async throws -> CategorizationSuggestion {
        try await remote.categorize(note: note, type: kind.rawValue).toDomain()
    }
}
