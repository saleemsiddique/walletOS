import Foundation

/// Llama a los endpoints de transacciones del wallet-service. Sin lógica de dominio (mismo patrón
/// que `AccountsRemoteDataSource`).
struct TransactionRemoteDataSource {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func delete(id: String) async throws {
        try await client.send(Endpoint(path: "transactions/\(id)", method: .delete))
    }
}
