import XCTest

@testable import WalletOS

// Fixtures de test: unwrap forzado sobre valores conocidos.
// swiftlint:disable force_unwrapping

final class TransactionSyncHandlerTests: XCTestCase {
    private var handler: TransactionSyncHandler!

    override func setUp() {
        super.setUp()
        let client = APIClient(baseURL: URL(string: "http://localhost/api")!, session: MockURLProtocol.session())
        handler = TransactionSyncHandler(remote: TransactionRemoteDataSource(client: client))
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        handler = nil
        super.tearDown()
    }

    func testPerformCreateTransactionPostsToWalletTransactionsEndpoint() async throws {
        var requestedPath: String?
        MockURLProtocol.handler = { request in
            requestedPath = request.url?.path
            let json = """
                {"id":"tx-1","wallet_id":"w1","wallet_name":"Nómina","bank_name":"Santander",
                "type":"EXPENSE","amount":42.3,"category":null,"note":null,"date":"2026-04-18",
                "transfer_id":null,"paired_wallet_name":null,"created_at":"2026-04-18T10:30:00Z"}
                """
            return MockURLProtocol.response(url: request.url!, status: 201, json: json)
        }
        let payload = try JSONEncoder().encode(
            TransactionSyncPayload(
                walletID: "w1",
                request: CreateTransactionRequestDTO(
                    id: "tx-1", type: "EXPENSE", amount: 42.3, categoryId: nil, note: nil, date: "2026-04-18")))
        let operation = SyncOperation(
            id: UUID(), type: .createTransaction, payload: payload, attempts: 0, status: .pending,
            createdAt: Date())

        _ = try await handler.perform(operation)

        XCTAssertEqual(requestedPath, "/api/wallets/w1/transactions")
    }

    func testPerformDeleteThroughQueueIsNotSupportedYet() async {
        let operation = SyncOperation(
            id: UUID(), type: .deleteTransaction, payload: Data(), attempts: 0, status: .pending,
            createdAt: Date())

        await assertThrowsAsync(_ = try await handler.perform(operation)) { _ in }
    }
}

// swiftlint:enable force_unwrapping
