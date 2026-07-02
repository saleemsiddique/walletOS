import Foundation

/// Abstracción que usa `APIClient` para autenticar peticiones y refrescar la sesión, sin acoplarse
/// a la implementación concreta del interceptor.
protocol RequestAuthorizing: Sendable {
    /// Devuelve la petición con las credenciales inyectadas.
    func authorized(_ request: URLRequest) async -> URLRequest
    /// Refresca la sesión; las llamadas concurrentes deben unirse a una sola.
    func refresh() async throws
}
