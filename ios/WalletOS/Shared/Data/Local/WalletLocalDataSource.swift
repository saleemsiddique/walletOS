import GRDB

/// DAO de `wallet`.
struct WalletLocalDataSource {
    let database: AppDatabase

    func upsert(_ wallet: WalletRecord) async throws {
        try await database.dbQueue.write { db in
            try wallet.save(db)
        }
    }

    func fetchAll(bankId: String? = nil) async throws -> [WalletRecord] {
        try await database.dbQueue.read { db in
            if let bankId {
                return
                    try WalletRecord
                    .filter(Column("bank_id") == bankId)
                    .fetchAll(db)
            }
            return try WalletRecord.fetchAll(db)
        }
    }
}
