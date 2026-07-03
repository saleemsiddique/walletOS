import GRDB

/// DAO de `category`.
struct CategoryLocalDataSource {
    let database: AppDatabase

    func upsert(_ category: CategoryRecord) async throws {
        try await database.dbQueue.write { db in
            try category.save(db)
        }
    }

    func fetchAll() async throws -> [CategoryRecord] {
        try await database.dbQueue.read { db in
            try CategoryRecord.fetchAll(db)
        }
    }
}
