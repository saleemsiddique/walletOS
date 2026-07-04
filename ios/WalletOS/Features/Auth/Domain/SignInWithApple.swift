/// Caso de uso: iniciar sesión con Apple canjeando el `identity_token` en el backend.
/// Al éxito la sesión queda persistida y el `AuthState` observable pasa a `signedIn`.
struct SignInWithApple {
    private let repository: AuthRepository

    init(repository: AuthRepository) {
        self.repository = repository
    }

    func execute(identityToken: String, name: String?) async throws {
        try await repository.signInWithApple(identityToken: identityToken, name: name)
    }
}
