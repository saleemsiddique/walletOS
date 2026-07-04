/// Caso de uso: iniciar sesión con Google canjeando el `id_token` en el backend.
/// Al éxito la sesión queda persistida y el `AuthState` observable pasa a `signedIn`.
struct SignInWithGoogle {
    private let repository: AuthRepository

    init(repository: AuthRepository) {
        self.repository = repository
    }

    func execute(idToken: String, name: String?) async throws {
        try await repository.signInWithGoogle(idToken: idToken, name: name)
    }
}
