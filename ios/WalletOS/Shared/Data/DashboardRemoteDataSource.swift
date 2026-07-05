import Foundation

/// Llama a `GET /dashboard` a través del `APIClient`. Sin lógica de dominio: solo construye el
/// `Endpoint` y devuelve el DTO (mismo patrón que `AccountsRemoteDataSource`).
struct DashboardRemoteDataSource {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func fetchDashboard() async throws -> DashboardResponseDTO {
        try await client.send(Endpoint(path: "dashboard", method: .get))
    }
}
