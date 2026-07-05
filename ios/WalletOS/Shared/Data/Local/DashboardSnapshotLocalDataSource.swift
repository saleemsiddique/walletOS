import GRDB

/// DAO de `dashboard_snapshot` (tabla singleton, Rama 15).
struct DashboardSnapshotLocalDataSource {
    let database: AppDatabase

    func upsert(_ record: DashboardSnapshotRecord) async throws {
        try await database.dbQueue.write { db in
            try record.save(db)
        }
    }

    func fetch() async throws -> DashboardSnapshotRecord? {
        try await database.dbQueue.read { db in
            try DashboardSnapshotRecord.fetchOne(db, key: DashboardSnapshotRecord.singletonId)
        }
    }
}
