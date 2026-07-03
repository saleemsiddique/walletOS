import Network

/// Wrapper sobre `NWPathMonitor` para detectar conectividad real del dispositivo.
final class NetworkMonitor: NetworkMonitoring {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.walletOS.network-monitor")

    func pathUpdates() -> AsyncStream<Bool> {
        AsyncStream { continuation in
            monitor.pathUpdateHandler = { path in
                continuation.yield(path.status == .satisfied)
            }
            monitor.start(queue: queue)
            continuation.onTermination = { [monitor] _ in
                monitor.cancel()
            }
        }
    }
}
