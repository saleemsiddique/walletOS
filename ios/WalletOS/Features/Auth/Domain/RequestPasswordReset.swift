/// Caso de uso: pedir el email de restablecimiento de contraseña. El backend responde 204
/// exista o no la cuenta (no revela existencia), así que el éxito solo significa "solicitud enviada".
struct RequestPasswordReset {
    private let repository: AuthRepository

    init(repository: AuthRepository) {
        self.repository = repository
    }

    func execute(email: String) async throws {
        try await repository.requestPasswordReset(email: email)
    }
}
