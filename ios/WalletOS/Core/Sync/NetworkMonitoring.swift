import Foundation

/// Abstracción de detección de conectividad, para poder testear el drenado automático de
/// `SyncQueue` sin depender de la red real.
protocol NetworkMonitoring: Sendable {
    /// Emite `true`/`false` cada vez que cambia la conectividad (incl. el estado inicial).
    func pathUpdates() -> AsyncStream<Bool>
}
