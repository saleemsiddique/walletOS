import Foundation

/// Tipo de escritura offline-first encolada.
enum SyncOperationType: String, Codable, Sendable {
    case createTransaction
    case updateTransaction
    case deleteTransaction
}

/// Estado de una operación en la cola.
enum SyncOperationStatus: String, Codable, Sendable {
    case pending
    case completed
    case failed
}

/// Operación de escritura pendiente de sincronizar, persistida en la tabla `sync_operation`
/// (Rama 6). El `id` es el UUID de cliente que viaja en el payload al backend, garantizando
/// idempotencia ante reintentos.
struct SyncOperation: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    var type: SyncOperationType
    var payload: Data
    var attempts: Int
    var status: SyncOperationStatus
    let createdAt: Date
}
