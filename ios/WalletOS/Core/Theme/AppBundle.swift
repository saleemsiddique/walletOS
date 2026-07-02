import Foundation

private final class BundleToken {}

extension Bundle {
    /// Bundle que contiene el asset catalog y los recursos de la app. Resuelto vía un token del
    /// módulo para funcionar igual desde la app y desde los tests (sin depender de `Bundle.main`).
    static let app = Bundle(for: BundleToken.self)
}
