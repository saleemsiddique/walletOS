/// Caso de uso: crear una cuenta con email, contraseña y nombre. Al éxito la sesión queda
/// persistida y el `AuthState` observable pasa a `signedIn`.
struct RegisterUser {
    private let repository: AuthRepository

    init(repository: AuthRepository) {
        self.repository = repository
    }

    func execute(email: String, password: String, name: String) async throws {
        try await repository.register(email: email, password: password, name: name)
    }
}
