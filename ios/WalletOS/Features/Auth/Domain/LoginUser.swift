/// Caso de uso: iniciar sesión con email y contraseña. Al éxito la sesión queda persistida
/// y el `AuthState` observable pasa a `signedIn`.
struct LoginUser {
    private let repository: AuthRepository

    init(repository: AuthRepository) {
        self.repository = repository
    }

    func execute(email: String, password: String) async throws {
        try await repository.login(email: email, password: password)
    }
}
