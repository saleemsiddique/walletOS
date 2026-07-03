import Foundation

/// Cómo ejecutar y reconciliar un tipo de operación de sync. `SyncQueue` es agnóstico al negocio;
/// cada feature (p. ej. Transactions, Rama 16) implementa esto con su repositorio remoto y local.
protocol SyncOperationHandling: Sendable {
    /// Ejecuta la operación contra el backend. Debe ser idempotente por `operation.id` — el
    /// backend soporta reintentos con el mismo id de cliente sin duplicar.
    func perform(_ operation: SyncOperation) async throws -> Data

    /// Aplica last-write-wins: la respuesta remota sobrescribe la copia local cacheada.
    func reconcile(operation: SyncOperation, remoteResponse: Data) async throws
}
