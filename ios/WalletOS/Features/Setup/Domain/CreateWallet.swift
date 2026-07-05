import Foundation

/// Caso de uso: crear el primer wallet del usuario dentro del banco recién creado.
struct CreateWallet {
    private let repository: WalletRepository

    init(repository: WalletRepository) {
        self.repository = repository
    }

    func execute(
        bankID: String,
        name: String,
        initialBalance: Decimal,
        color: String
    ) async throws -> Wallet {
        try await repository.createWallet(
            bankID: bankID,
            name: name,
            initialBalance: initialBalance,
            color: color
        )
    }
}
