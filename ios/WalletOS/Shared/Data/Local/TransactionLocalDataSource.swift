import GRDB

/// DAO de `transaction`. `id` es el UUID de cliente (idempotencia offline-first).
struct TransactionLocalDataSource {
    let database: AppDatabase

    func upsert(_ transaction: TransactionRecord) async throws {
        try await database.dbQueue.write { db in
            try transaction.save(db)
        }
    }

    /// Historial de un wallet, más recientes primero (para la pantalla de transacciones del wallet).
    func fetchAll(walletId: String) async throws -> [TransactionRecord] {
        try await database.dbQueue.read { db in
            try TransactionRecord
                .filter(Column("wallet_id") == walletId)
                .order(Column("date").desc)
                .fetchAll(db)
        }
    }
}
