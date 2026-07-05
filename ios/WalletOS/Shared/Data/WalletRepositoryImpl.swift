import Foundation

/// Implementación de `WalletRepository`: delega en el data source remoto y mapea DTO → dominio.
final class WalletRepositoryImpl: WalletRepository {
    private let remote: AccountsRemoteDataSource

    init(remote: AccountsRemoteDataSource) {
        self.remote = remote
    }

    func createWallet(
        bankID: String,
        name: String,
        initialBalance: Decimal,
        color: String
    ) async throws -> Wallet {
        let dto = try await remote.createWallet(
            bankID: bankID,
            name: name,
            initialBalance: initialBalance,
            color: color
        )
        return dto.toDomain(fallbackBankID: bankID)
    }
}
