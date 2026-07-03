/// Cablea el drenado automático: al recuperar conectividad, drena la cola.
extension SyncQueue {
    func observeConnectivity(_ monitor: NetworkMonitoring) {
        Task { [self] in
            for await isConnected in monitor.pathUpdates() where isConnected {
                await drain()
            }
        }
    }
}
