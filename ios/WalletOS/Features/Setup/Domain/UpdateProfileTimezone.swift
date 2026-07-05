/// Caso de uso: fijar la zona horaria del usuario a partir de la del dispositivo, para que los
/// recordatorios del backend lleguen a la hora local correcta.
struct UpdateProfileTimezone {
    private let repository: ProfileRepository

    init(repository: ProfileRepository) {
        self.repository = repository
    }

    func execute(_ identifier: String) async throws {
        try await repository.updateTimezone(identifier)
    }
}
