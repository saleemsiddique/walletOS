import Foundation

/// Implementa `SyncOperationHandling` para las escrituras de transacciones (Rama 16: crear). La
/// `SyncQueue` es agnóstica al negocio; este handler traduce la operación a la llamada remota.
/// `perform` es idempotente por el UUID de cliente del payload — un reintento no duplica.
struct TransactionSyncHandler: SyncOperationHandling {
    private let remote: TransactionRemoteDataSource

    init(remote: TransactionRemoteDataSource) {
        self.remote = remote
    }

    func perform(_ operation: SyncOperation) async throws -> Data {
        switch operation.type {
        case .createTransaction:
            let payload = try JSONDecoder().decode(TransactionSyncPayload.self, from: operation.payload)
            _ = try await remote.create(walletID: payload.walletID, request: payload.request)
            return Data()
        case .updateTransaction, .deleteTransaction:
            // Update/delete a través de la cola llegan en ramas posteriores; hoy no se encolan.
            throw APIError.server(status: -1)
        }
    }

    func reconcile(operation: SyncOperation, remoteResponse: Data) async throws {
        // Home recarga el dashboard del backend tras drenar, así que no hay copia local que
        // reconciliar aquí todavía. La cache local de transacciones llega con la vista de Actividad.
    }
}
