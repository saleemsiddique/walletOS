import Foundation

/// Llama a los endpoints de transacciones y transferencias del wallet-service. Sin lógica de
/// dominio (mismo patrón que `AccountsRemoteDataSource`).
struct TransactionRemoteDataSource {
    private let client: APIClient
    private let encoder: JSONEncoder

    init(client: APIClient) {
        self.client = client
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func create(walletID: String, request: CreateTransactionRequestDTO) async throws -> TransactionDTO {
        let body = try encoder.encode(request)
        return try await client.send(
            Endpoint(path: "wallets/\(walletID)/transactions", method: .post, body: body))
    }

    func createTransfer(request: CreateTransferRequestDTO) async throws {
        let body = try encoder.encode(request)
        try await client.send(Endpoint(path: "transfers", method: .post, body: body))
    }

    func delete(id: String) async throws {
        try await client.send(Endpoint(path: "transactions/\(id)", method: .delete))
    }
}
