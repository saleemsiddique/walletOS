import Foundation

/// Llama a los endpoints de bancos y wallets del wallet-service a través del `APIClient`. Sin lógica
/// de dominio: solo traduce parámetros a `Endpoint` y devuelve DTOs.
struct AccountsRemoteDataSource {
    private let client: APIClient
    private let encoder: JSONEncoder

    init(client: APIClient) {
        self.client = client
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func fetchBanks() async throws -> BanksResponseDTO {
        try await client.send(Endpoint(path: "banks", method: .get))
    }

    func createBank(name: String, icon: String?, color: String) async throws -> BankDTO {
        let body = try encoder.encode(CreateBankRequestDTO(name: name, icon: icon, color: color))
        return try await client.send(Endpoint(path: "banks", method: .post, body: body))
    }

    func createWallet(
        bankID: String,
        name: String,
        initialBalance: Decimal,
        color: String
    ) async throws -> WalletDTO {
        let request = CreateWalletRequestDTO(
            name: name,
            type: "CASH",
            initialBalance: initialBalance,
            color: color
        )
        let body = try encoder.encode(request)
        return try await client.send(Endpoint(path: "banks/\(bankID)/wallets", method: .post, body: body))
    }
}
