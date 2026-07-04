/// Caso de uso: fijar una contraseña nueva con el token del email de recuperación. El backend
/// invalida todas las sesiones del usuario; la sesión local también queda limpia.
struct ResetPassword {
    private let repository: AuthRepository

    init(repository: AuthRepository) {
        self.repository = repository
    }

    func execute(token: String, newPassword: String) async throws {
        try await repository.resetPassword(token: token, newPassword: newPassword)
    }
}
