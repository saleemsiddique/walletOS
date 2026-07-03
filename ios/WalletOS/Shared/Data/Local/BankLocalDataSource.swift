import GRDB

/// DAO de `bank`. `upsert` inserta o actualiza por `id` (GRDB intenta `UPDATE`; si no existe, `INSERT`).
struct BankLocalDataSource {
    let database: AppDatabase

    func upsert(_ bank: BankRecord) async throws {
        try await database.dbQueue.write { db in
            try bank.save(db)
        }
    }

    func fetchAll() async throws -> [BankRecord] {
        try await database.dbQueue.read { db in
            try BankRecord.fetchAll(db)
        }
    }
}
