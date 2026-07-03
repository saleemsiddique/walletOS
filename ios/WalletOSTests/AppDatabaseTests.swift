import GRDB
import XCTest

@testable import WalletOS

final class AppDatabaseTests: XCTestCase {
    private var database: AppDatabase!

    override func setUp() async throws {
        try await super.setUp()
        database = try AppDatabase.openInMemory()
    }

    override func tearDown() async throws {
        database = nil
        try await super.tearDown()
    }

    func testMigrationCreatesAllTables() async throws {
        let expectedTables = ["bank", "wallet", "category", "transaction", "recurring_rule", "sync_operation"]
        let tables = try await database.dbQueue.read { db in
            try String.fetchSet(db, sql: "SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        for table in expectedTables {
            XCTAssertTrue(tables.contains(table), "falta la tabla '\(table)'")
        }
    }

    func testMigrationCreatesExpectedIndices() async throws {
        let expectedIndices = ["wallet_on_bank_id", "transaction_on_wallet_id_and_date"]
        let indices = try await database.dbQueue.read { db in
            try String.fetchSet(db, sql: "SELECT name FROM sqlite_master WHERE type = 'index'")
        }
        for index in expectedIndices {
            XCTAssertTrue(indices.contains(index), "falta el índice '\(index)'")
        }
    }

    /// Inserta un banco fixture para satisfacer la FK de `wallet.bank_id`.
    private func insertFixtureBank(id: String = "b1") async throws {
        try await BankLocalDataSource(database: database).upsert(
            BankRecord(
                id: id, name: "Santander", icon: "🏦", color: "#E31837", isArchived: false,
                createdAt: "2026-01-01", updatedAt: "2026-01-01"))
    }

    /// Inserta banco + wallet fixture para satisfacer la FK de `transaction.wallet_id`.
    private func insertFixtureWallet(id: String = "w1", bankId: String = "b1") async throws {
        try await insertFixtureBank(id: bankId)
        try await WalletLocalDataSource(database: database).upsert(
            WalletRecord(
                id: id, bankId: bankId, name: "Ahorro", type: "CASH", icon: "💰", color: "#34C759",
                balance: 0, isArchived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01"))
    }

    func testWalletUpsertInsertsThenUpdatesById() async throws {
        try await insertFixtureBank()
        let dataSource = WalletLocalDataSource(database: database)
        let wallet = WalletRecord(
            id: "w1", bankId: "b1", name: "Ahorro", type: "CASH", icon: "💰", color: "#34C759",
            balance: 100, isArchived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01")
        try await dataSource.upsert(wallet)

        var updated = wallet
        updated.name = "Ahorro extra"
        updated.balance = 250
        try await dataSource.upsert(updated)

        let stored = try await dataSource.fetchAll()
        XCTAssertEqual(stored.count, 1, "el upsert no debe duplicar la fila")
        XCTAssertEqual(stored.first?.name, "Ahorro extra")
        XCTAssertEqual(stored.first?.balance, 250)
    }

    func testTransactionUpsertInsertsThenUpdatesById() async throws {
        try await insertFixtureWallet()
        let dataSource = TransactionLocalDataSource(database: database)
        let transaction = TransactionRecord(
            id: "t1", walletId: "w1", type: "EXPENSE", amount: 10, categoryId: nil, note: "Café",
            date: "2026-04-18", transferId: nil, createdAt: "2026-04-18T10:00:00Z")
        try await dataSource.upsert(transaction)

        var updated = transaction
        updated.amount = 15
        updated.note = "Café con leche"
        try await dataSource.upsert(updated)

        let stored = try await dataSource.fetchAll(walletId: "w1")
        XCTAssertEqual(stored.count, 1, "el upsert no debe duplicar la fila")
        XCTAssertEqual(stored.first?.amount, 15)
        XCTAssertEqual(stored.first?.note, "Café con leche")
    }

    func testTransactionsAreFetchedOrderedByDateDescending() async throws {
        try await insertFixtureWallet()
        let dataSource = TransactionLocalDataSource(database: database)
        let dates = ["2026-04-10", "2026-04-18", "2026-04-05"]
        for (index, date) in dates.enumerated() {
            try await dataSource.upsert(
                TransactionRecord(
                    id: "t\(index)", walletId: "w1", type: "EXPENSE", amount: 1, categoryId: nil,
                    note: nil, date: date, transferId: nil, createdAt: "\(date)T00:00:00Z"))
        }

        let stored = try await dataSource.fetchAll(walletId: "w1")

        XCTAssertEqual(stored.map(\.date), ["2026-04-18", "2026-04-10", "2026-04-05"])
    }
}
