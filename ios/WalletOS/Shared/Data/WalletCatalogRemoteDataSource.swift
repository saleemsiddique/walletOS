import Foundation

/// Lecturas para poblar los selectores del modal de transacción: wallets planos, categorías y la
/// categorización por IA. Sin lógica de dominio (mismo patrón que `AccountsRemoteDataSource`).
struct WalletCatalogRemoteDataSource {
    private let client: APIClient
    private let encoder: JSONEncoder

    init(client: APIClient) {
        self.client = client
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func fetchWallets() async throws -> WalletsResponseDTO {
        try await client.send(Endpoint(path: "wallets", method: .get))
    }

    func fetchCategories(type: String) async throws -> CategoriesResponseDTO {
        try await client.send(Endpoint(path: "categories", method: .get, query: ["type": type]))
    }

    func categorize(note: String, type: String) async throws -> CategorizeResponseDTO {
        let body = try encoder.encode(CategorizeRequestDTO(note: note, type: type))
        return try await client.send(Endpoint(path: "categorize", method: .post, body: body))
    }
}
