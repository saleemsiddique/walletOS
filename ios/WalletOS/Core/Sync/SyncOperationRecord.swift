import Foundation
import GRDB

/// Espejo GRDB de `SyncOperation` en la tabla `sync_operation` (Rama 6). Columnas en texto, igual
/// que el resto de records de cache, para mantener el mismo patrón de persistencia.
struct SyncOperationRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "sync_operation"

    var id: String
    var type: String
    var payload: String
    var attempts: Int
    var status: String
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, payload, attempts, status
        case createdAt = "created_at"
    }
}

extension SyncOperationRecord {
    init(_ operation: SyncOperation) {
        self.init(
            id: operation.id.uuidString,
            type: operation.type.rawValue,
            payload: operation.payload.base64EncodedString(),
            attempts: operation.attempts,
            status: operation.status.rawValue,
            createdAt: ISO8601DateFormatter().string(from: operation.createdAt)
        )
    }

    /// `nil` si el registro tiene datos corruptos (no debería ocurrir salvo migración de datos externa).
    func toDomain() -> SyncOperation? {
        guard
            let id = UUID(uuidString: id),
            let type = SyncOperationType(rawValue: type),
            let status = SyncOperationStatus(rawValue: status),
            let payloadData = Data(base64Encoded: payload),
            let createdAt = ISO8601DateFormatter().date(from: createdAt)
        else {
            return nil
        }
        return SyncOperation(
            id: id, type: type, payload: payloadData, attempts: attempts, status: status, createdAt: createdAt)
    }
}
