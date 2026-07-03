import XCTest

@testable import WalletOS

/// Handler de test: registra las operaciones que recibe y puede fallar N veces antes de tener éxito.
private actor FakeSyncOperationHandler: SyncOperationHandling {
    enum Behavior {
        case alwaysSucceed
        case alwaysFail
        case failThenSucceed(failures: Int)
    }

    private(set) var performedIds: [UUID] = []
    private(set) var performedPayloads: [String] = []
    private(set) var reconciledIds: [UUID] = []
    private var remainingFailures: Int

    init(behavior: Behavior) {
        switch behavior {
        case .alwaysSucceed: remainingFailures = 0
        case .alwaysFail: remainingFailures = .max
        case .failThenSucceed(let failures): remainingFailures = failures
        }
    }

    func perform(_ operation: SyncOperation) async throws -> Data {
        performedIds.append(operation.id)
        performedPayloads.append(String(data: operation.payload, encoding: .utf8) ?? "")
        if remainingFailures > 0 {
            remainingFailures -= 1
            throw URLError(.badServerResponse)
        }
        return Data("ok".utf8)
    }

    func reconcile(operation: SyncOperation, remoteResponse: Data) async throws {
        reconciledIds.append(operation.id)
    }
}

final class SyncQueueTests: XCTestCase {
    private func makeQueue(handler: SyncOperationHandling) async throws -> SyncQueue {
        let database = try AppDatabase.openInMemory()
        return SyncQueue(database: database, handler: handler, sleeper: { _ in })
    }

    func testEnqueuedOperationIsPendingThenCompletesAfterDrain() async throws {
        let handler = FakeSyncOperationHandler(behavior: .alwaysSucceed)
        let queue = try await makeQueue(handler: handler)
        let operation = try await queue.enqueue(type: .createTransaction, payload: Data("x".utf8))

        let pendingBeforeDrain = try await queue.fetchPending()
        XCTAssertEqual(pendingBeforeDrain.map(\.id), [operation.id])

        await queue.drain()

        let pendingAfterDrain = try await queue.fetchPending()
        let all = try await queue.fetchAll()
        XCTAssertTrue(pendingAfterDrain.isEmpty)
        XCTAssertEqual(all.first?.status, .completed)
        let reconciledIds = await handler.reconciledIds
        XCTAssertEqual(reconciledIds, [operation.id])
    }

    func testFIFOOrderIsRespectedAcrossMultipleOperations() async throws {
        let handler = FakeSyncOperationHandler(behavior: .alwaysSucceed)
        let queue = try await makeQueue(handler: handler)
        _ = try await queue.enqueue(type: .createTransaction, payload: Data("first".utf8))
        _ = try await queue.enqueue(type: .createTransaction, payload: Data("second".utf8))
        _ = try await queue.enqueue(type: .createTransaction, payload: Data("third".utf8))

        await queue.drain()

        let performedPayloads = await handler.performedPayloads
        XCTAssertEqual(performedPayloads, ["first", "second", "third"])
    }

    func testRetryUsesTheSameOperationIdWithoutDuplicatingTheRow() async throws {
        let handler = FakeSyncOperationHandler(behavior: .failThenSucceed(failures: 2))
        let queue = try await makeQueue(handler: handler)
        let operation = try await queue.enqueue(type: .createTransaction, payload: Data("x".utf8))

        await queue.drain()

        let performedIds = await handler.performedIds
        XCTAssertEqual(
            performedIds, [operation.id, operation.id, operation.id],
            "el backend debe ver siempre el mismo id de cliente")
        let all = try await queue.fetchAll()
        XCTAssertEqual(all.count, 1, "un reintento no debe crear una fila nueva")
        XCTAssertEqual(all.first?.status, .completed)
    }

    func testExhaustingRetriesMarksTheOperationFailedAndEmitsTheEvent() async throws {
        let handler = FakeSyncOperationHandler(behavior: .alwaysFail)
        let queue = try await makeQueue(handler: handler)
        let operation = try await queue.enqueue(type: .createTransaction, payload: Data("x".utf8))
        var iterator = queue.failedOperations.makeAsyncIterator()

        await queue.drain()

        let failedEvent = await iterator.next()
        XCTAssertEqual(failedEvent?.id, operation.id)
        XCTAssertEqual(failedEvent?.attempts, 5)
        XCTAssertEqual(failedEvent?.status, .failed)

        let failed = try await queue.fetchFailed()
        XCTAssertEqual(failed.map(\.id), [operation.id])
        let performedIds = await handler.performedIds
        XCTAssertEqual(performedIds.count, 5, "5 intentos antes de marcar failed")
    }
}
