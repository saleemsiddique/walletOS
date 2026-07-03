import Foundation

/// Flags booleanos simples que no ameritan un entorno completo. Por defecto derivan del entorno
/// activo, pero son overrideables individualmente si hace falta.
enum FeatureFlags {
    /// APNs sandbox (dev/staging) vs producción. Ver Rama 27.
    static var useSandboxAPNs: Bool {
        AppEnvironment.current != .prod
    }
}
