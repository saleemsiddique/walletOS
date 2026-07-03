import Foundation
import GRDB

/// Cola FIFO de escrituras offline-first, persistida en GRDB. Drena en orden de inserción,
/// reintenta con backoff exponencial y expone las operaciones que agotan reintentos para que la
/// UI muestre el banner "Operación pendiente".
actor SyncQueue {
    typealias Sleeper = @Sendable (UInt64) async throws -> Void

    private let database: AppDatabase
    private let handler: SyncOperationHandling
    private let maxAttempts: Int
    private let backoffSeconds: [UInt64]
    private let sleeper: Sleeper
    private var isDraining = false
    private let failureContinuation: AsyncStream<SyncOperation>.Continuation

    /// Operaciones que agotaron sus reintentos (`status = .failed`); la UI se suscribe para el banner.
    nonisolated let failedOperations: AsyncStream<SyncOperation>

    init(
        database: AppDatabase,
        handler: SyncOperationHandling,
        maxAttempts: Int = 5,
        backoffSeconds: [UInt64] = [1, 2, 4, 8, 16],
        sleeper: @escaping Sleeper = { seconds in
            try await Task.sleep(nanoseconds: seconds * 1_000_000_000)
        }
    ) {
        self.database = database
        self.handler = handler
        self.maxAttempts = maxAttempts
        self.backoffSeconds = backoffSeconds
        self.sleeper = sleeper

        var continuation: AsyncStream<SyncOperation>.Continuation!
        self.failedOperations = AsyncStream { continuation = $0 }
        self.failureContinuation = continuation
    }

    /// Encola una operación offline-first; queda `pending` hasta que se drena la cola.
    @discardableResult
    func enqueue(type: SyncOperationType, payload: Data) async throws -> SyncOperation {
        let operation = SyncOperation(
            id: UUID(), type: type, payload: payload, attempts: 0, status: .pending, createdAt: Date())
        try await persist(operation)
        return operation
    }

    /// Drena la cola en orden FIFO. Si una operación falla, se reintenta con backoff antes de
    /// continuar con la siguiente (preserva el orden causal entre escrituras relacionadas).
    func drain() async {
        guard !isDraining else { return }
        isDraining = true
        defer { isDraining = false }

        guard let pending = try? await fetchPending() else { return }
        for operation in pending {
            await process(operation)
        }
    }

    func fetchAll() async throws -> [SyncOperation] {
        try await database.dbQueue.read { db in
            try SyncOperationRecord.fetchAll(db, sql: "SELECT * FROM sync_operation ORDER BY rowid ASC")
        }
        .compactMap { $0.toDomain() }
    }

    func fetchPending() async throws -> [SyncOperation] {
        try await fetch(status: .pending)
    }

    func fetchFailed() async throws -> [SyncOperation] {
        try await fetch(status: .failed)
    }

    private func fetch(status: SyncOperationStatus) async throws -> [SyncOperation] {
        try await database.dbQueue.read { db in
            try SyncOperationRecord.fetchAll(
                db,
                sql: "SELECT * FROM sync_operation WHERE status = ? ORDER BY rowid ASC",
                arguments: [status.rawValue]
            )
        }
        .compactMap { $0.toDomain() }
    }

    private func process(_ operation: SyncOperation) async {
        do {
            let response = try await handler.perform(operation)
            try await handler.reconcile(operation: operation, remoteResponse: response)
            var completed = operation
            completed.status = .completed
            try? await persist(completed)
        } catch {
            await retryOrFail(operation)
        }
    }

    private func retryOrFail(_ operation: SyncOperation) async {
        var updated = operation
        updated.attempts += 1

        guard updated.attempts < maxAttempts else {
            updated.status = .failed
            try? await persist(updated)
            failureContinuation.yield(updated)
            return
        }

        try? await persist(updated)
        let delayIndex = min(updated.attempts - 1, backoffSeconds.count - 1)
        try? await sleeper(backoffSeconds[delayIndex])
        await process(updated)
    }

    private func persist(_ operation: SyncOperation) async throws {
        try await database.dbQueue.write { db in
            try SyncOperationRecord(operation).save(db)
        }
    }
}
