import Foundation

/// Implementación de `AuthRepository`: canjea credenciales en el user-service y persiste la sesión
/// resultante en el `TokenStore` (que a su vez publica el cambio en el `AuthState`).
final class AuthRepositoryImpl: AuthRepository {
    private let remote: AuthRemoteDataSource
    private let tokenStore: TokenStoring

    init(remote: AuthRemoteDataSource, tokenStore: TokenStoring) {
        self.remote = remote
        self.tokenStore = tokenStore
    }

    func register(email: String, password: String, name: String) async throws {
        let response = try await remote.register(email: email, password: password, name: name)
        await tokenStore.saveTokens(access: response.accessToken, refresh: response.refreshToken)
    }

    func login(email: String, password: String) async throws {
        let response = try await remote.login(email: email, password: password)
        await tokenStore.saveTokens(access: response.accessToken, refresh: response.refreshToken)
    }

    func signInWithApple(identityToken: String, name: String?) async throws {
        let response = try await remote.signInWithApple(identityToken: identityToken, name: name)
        await tokenStore.saveTokens(access: response.accessToken, refresh: response.refreshToken)
    }

    func signInWithGoogle(idToken: String, name: String?) async throws {
        let response = try await remote.signInWithGoogle(idToken: idToken, name: name)
        await tokenStore.saveTokens(access: response.accessToken, refresh: response.refreshToken)
    }

    func refresh() async throws {
        guard let refreshToken = await tokenStore.refreshToken else {
            throw APIError.unauthorized
        }
        let tokens = try await remote.refresh(refreshToken: refreshToken)
        await tokenStore.saveTokens(access: tokens.accessToken, refresh: tokens.refreshToken)
    }

    func logout() async {
        // Cerrar sesión nunca se bloquea por red: la invalidación del refresh token en el backend
        // es mejor esfuerzo y la sesión local se limpia siempre.
        if let refreshToken = await tokenStore.refreshToken {
            try? await remote.logout(refreshToken: refreshToken)
        }
        await tokenStore.clear()
    }
}
