final class TransactionRepositoryImpl: TransactionRepository {
    private let remote: TransactionRemoteDataSource

    init(remote: TransactionRemoteDataSource) {
        self.remote = remote
    }

    func delete(id: String) async throws {
        try await remote.delete(id: id)
    }
}
