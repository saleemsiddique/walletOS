import Foundation
import GRDB

/// Base de datos local (GRDB/SQLite): cache de solo lectura de bank/wallet/category/transaction/
/// recurring_rule y la tabla `sync_operation` que sostiene la cola de sincronización (Rama 7).
final class AppDatabase {
    let dbQueue: any DatabaseWriter

    init(dbQueue: any DatabaseWriter) throws {
        self.dbQueue = dbQueue
        try Self.migrator.migrate(dbQueue)
    }

    /// Abre (o crea) la base de datos en `Application Support/WalletOS/db.sqlite`.
    static func openInApplicationSupport() throws -> AppDatabase {
        let directory = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("WalletOS", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let path = directory.appendingPathComponent("db.sqlite").path
        return try AppDatabase(dbQueue: try DatabaseQueue(path: path))
    }

    /// Base de datos en memoria para tests y previews.
    static func openInMemory() throws -> AppDatabase {
        try AppDatabase(dbQueue: try DatabaseQueue())
    }

    private static var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1_initial_schema") { db in
            try db.create(table: "bank") { table in
                table.column("id", .text).primaryKey()
                table.column("name", .text).notNull()
                table.column("icon", .text).notNull()
                table.column("color", .text).notNull()
                table.column("is_archived", .boolean).notNull().defaults(to: false)
                table.column("created_at", .text).notNull()
                table.column("updated_at", .text).notNull()
            }

            try db.create(table: "wallet") { table in
                table.column("id", .text).primaryKey()
                table.column("bank_id", .text).notNull().references("bank", onDelete: .cascade)
                table.column("name", .text).notNull()
                table.column("type", .text).notNull()
                table.column("icon", .text).notNull()
                table.column("color", .text).notNull()
                table.column("balance", .double).notNull()
                table.column("is_archived", .boolean).notNull().defaults(to: false)
                table.column("created_at", .text).notNull()
                table.column("updated_at", .text).notNull()
            }
            try db.create(index: "wallet_on_bank_id", on: "wallet", columns: ["bank_id"])

            try db.create(table: "category") { table in
                table.column("id", .text).primaryKey()
                table.column("name", .text).notNull()
                table.column("icon", .text).notNull()
                table.column("type", .text).notNull()
                table.column("is_custom", .boolean).notNull().defaults(to: false)
            }

            try db.create(table: "transaction") { table in
                table.column("id", .text).primaryKey()
                table.column("wallet_id", .text).notNull().references("wallet", onDelete: .cascade)
                table.column("type", .text).notNull()
                table.column("amount", .double).notNull()
                table.column("category_id", .text).references("category", onDelete: .setNull)
                table.column("note", .text)
                table.column("date", .text).notNull()
                table.column("transfer_id", .text)
                table.column("created_at", .text).notNull()
            }
            try db.create(
                index: "transaction_on_wallet_id_and_date",
                on: "transaction",
                columns: ["wallet_id", "date"]
            )

            try db.create(table: "recurring_rule") { table in
                table.column("id", .text).primaryKey()
                table.column("wallet_id", .text).notNull().references("wallet", onDelete: .cascade)
                table.column("type", .text).notNull()
                table.column("amount", .double).notNull()
                table.column("category_id", .text).references("category", onDelete: .setNull)
                table.column("note", .text)
                table.column("frequency", .text).notNull()
                table.column("day_of_month", .integer)
                table.column("day_of_week", .integer)
                table.column("next_run", .text).notNull()
                table.column("is_active", .boolean).notNull().defaults(to: true)
                table.column("created_at", .text).notNull()
            }

            try db.create(table: "sync_operation") { table in
                table.column("id", .text).primaryKey()
                table.column("type", .text).notNull()
                table.column("payload", .text).notNull()
                table.column("attempts", .integer).notNull().defaults(to: 0)
                table.column("status", .text).notNull().defaults(to: "pending")
                table.column("created_at", .text).notNull()
            }
        }

        return migrator
    }
}
