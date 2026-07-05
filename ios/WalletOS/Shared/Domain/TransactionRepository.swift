protocol TransactionRepository {
    func delete(id: String) async throws
}
