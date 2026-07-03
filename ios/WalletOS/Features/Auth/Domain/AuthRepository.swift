import Foundation

/// Contrato de autenticación de la feature. La implementación (Data) canjea credenciales contra el
/// user-service y persiste la sesión en el `TokenStore`; el resto de la app solo ve este protocolo.
protocol AuthRepository {
    func register(email: String, password: String, name: String) async throws
    func login(email: String, password: String) async throws
    func refresh() async throws
    func logout() async
}
