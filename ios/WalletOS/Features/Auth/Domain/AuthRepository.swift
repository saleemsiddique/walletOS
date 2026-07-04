import Foundation

/// Contrato de autenticación de la feature. La implementación (Data) canjea credenciales contra el
/// user-service y persiste la sesión en el `TokenStore`; el resto de la app solo ve este protocolo.
protocol AuthRepository {
    func register(email: String, password: String, name: String) async throws
    func login(email: String, password: String) async throws
    /// Canjea el `identity_token` de Apple en el backend. `name` solo llega en la primera
    /// autorización (Apple no lo repite) y el backend lo exige solo al crear la cuenta.
    func signInWithApple(identityToken: String, name: String?) async throws
    /// Canjea el `id_token` de Google en el backend; `name` viene del perfil de Google.
    func signInWithGoogle(idToken: String, name: String?) async throws
    func refresh() async throws
    func logout() async
}
