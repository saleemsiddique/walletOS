import XCTest

@testable import WalletOS

// Fixtures de test: se permite el unwrap forzado sobre valores conocidos.
// swiftlint:disable force_unwrapping force_try

private let sampleDashboardJSON = """
    {
      "total_balance": 4870.5,
      "month_expense": 820.5,
      "month_expense_change_pct": 12.3,
      "recent_transactions": [
        {
          "id": "t1", "wallet_id": "w1", "wallet_name": "Nómina", "bank_name": "Santander",
          "type": "EXPENSE", "amount": 42.3,
          "category": { "id": "c1", "name": "Comida", "icon": "🍔" },
          "note": "Mercadona", "date": "2026-04-18",
          "transfer_id": null, "paired_wallet_name": null,
          "created_at": "2026-04-18T10:30:00Z"
        }
      ]
    }
    """

final class DashboardRepositoryImplTests: XCTestCase {
    private var repository: DashboardRepositoryImpl!

    override func setUp() {
        super.setUp()
        let client = APIClient(baseURL: URL(string: "http://localhost/api")!, session: MockURLProtocol.session())
        let database = try! AppDatabase.openInMemory()
        repository = DashboardRepositoryImpl(
            remote: DashboardRemoteDataSource(client: client),
            local: DashboardSnapshotLocalDataSource(database: database)
        )
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        repository = nil
        super.tearDown()
    }

    func testFetchDashboardSucceedsAndCachesForOfflineUse() async throws {
        MockURLProtocol.handler = { request in
            MockURLProtocol.response(url: request.url!, status: 200, json: sampleDashboardJSON)
        }

        let snapshot = try await repository.fetchDashboard()

        XCTAssertEqual(snapshot.totalBalance, 4870.5)
        XCTAssertFalse(snapshot.isFromCache)

        MockURLProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }
        let cached = try await repository.fetchDashboard()

        XCTAssertEqual(cached.totalBalance, 4870.5)
        XCTAssertTrue(cached.isFromCache, "sin red, sirve la cache guardada en el fetch anterior")
        XCTAssertNotNil(cached.cachedAt)
    }

    func testFetchDashboardOfflineWithoutPriorCacheRethrowsOffline() async {
        MockURLProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }

        await assertThrowsAsync(try await repository.fetchDashboard()) { error in
            XCTAssertEqual(error as? APIError, .offline)
        }
    }
}

// swiftlint:enable force_unwrapping force_try
