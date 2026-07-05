/// Caso de uso: cargar una transacción por id para precargar el modal en edición.
struct FetchTransaction {
    private let repository: TransactionRepository

    init(repository: TransactionRepository) {
        self.repository = repository
    }

    func execute(id: String) async throws -> EditableTransaction {
        try await repository.fetch(id: id)
    }
}
