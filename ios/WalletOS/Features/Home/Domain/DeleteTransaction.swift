/// Caso de uso: borrar una transacción (swipe→borrar con undo en Patrimonio).
struct DeleteTransaction {
    private let repository: TransactionRepository

    init(repository: TransactionRepository) {
        self.repository = repository
    }

    func execute(id: String) async throws {
        try await repository.delete(id: id)
    }
}
