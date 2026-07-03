import XCTest

@testable import WalletOS

/// `NetworkMonitoring` de test: el propio test controla cuándo "llega" la conectividad.
private final class FakeNetworkMonitor: NetworkMonitoring, @unchecked Sendable {
    private let stream: AsyncStream<Bool>
    let continuation: AsyncStream<Bool>.Continuation

    init() {
        var continuation: AsyncStream<Bool>.Continuation!
        stream = AsyncStream { continuation = $0 }
        self.continuation = continuation
    }

    func pathUpdates() -> AsyncStream<Bool> { stream }
}

private actor AlwaysSucceedingHandler: SyncOperationHandling {
    func perform(_ operation: SyncOperation) async throws -> Data { Data("ok".utf8) }
    func reconcile(operation: SyncOperation, remoteResponse: Data) async throws {}
}

final class SyncQueueConnectivityTests: XCTestCase {
    func testDrainsAutomaticallyWhenConnectivityIsRestored() async throws {
        let database = try AppDatabase.openInMemory()
        let queue = SyncQueue(database: database, handler: AlwaysSucceedingHandler(), sleeper: { _ in })
        try await queue.enqueue(type: .createTransaction, payload: Data("x".utf8))

        let monitor = FakeNetworkMonitor()
        await queue.observeConnectivity(monitor)
        monitor.continuation.yield(true)

        // Cede el hilo para que el Task lanzado por `observeConnectivity` procese el evento.
        try await Task.sleep(nanoseconds: 200_000_000)

        let pending = try await queue.fetchPending()
        XCTAssertTrue(pending.isEmpty, "recuperar la red debería haber drenado la cola")
    }
}
