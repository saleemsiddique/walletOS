import Foundation

/// Llama a `PATCH /me` del user-service. La respuesta (perfil actualizado) no se necesita en Setup,
/// así que se descarta.
struct ProfileRemoteDataSource {
    private let client: APIClient
    private let encoder: JSONEncoder

    init(client: APIClient) {
        self.client = client
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func updateTimezone(_ identifier: String) async throws {
        let body = try encoder.encode(UpdateProfileRequestDTO(timezone: identifier))
        try await client.send(Endpoint(path: "me", method: .patch, body: body))
    }
}
