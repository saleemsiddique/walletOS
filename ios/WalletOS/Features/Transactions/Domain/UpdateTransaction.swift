import Foundation

/// Caso de uso: editar una transacción normal (`PATCH /transactions/:id`). Directo, no offline-first
/// —igual que el borrado—: editar sin red es un caso de borde poco frecuente frente a crear.
struct UpdateTransaction {
    private let repository: TransactionRepository

    init(repository: TransactionRepository) {
        self.repository = repository
    }

    func execute(
        id: String,
        type: String,
        amount: Decimal,
        categoryId: String?,
        note: String?,
        date: String
    ) async throws {
        try await repository.update(
            id: id, type: type, amount: amount, categoryId: categoryId, note: note, date: date)
    }
}
