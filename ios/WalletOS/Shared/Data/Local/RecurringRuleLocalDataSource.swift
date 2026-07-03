import GRDB

/// DAO de `recurring_rule`.
struct RecurringRuleLocalDataSource {
    let database: AppDatabase

    func upsert(_ rule: RecurringRuleRecord) async throws {
        try await database.dbQueue.write { db in
            try rule.save(db)
        }
    }

    func fetchAll() async throws -> [RecurringRuleRecord] {
        try await database.dbQueue.read { db in
            try RecurringRuleRecord.fetchAll(db)
        }
    }
}
