import Foundation

/// Implementación de `WalletRepository`: delega en los data sources remotos y mapea DTO → dominio.
final class WalletRepositoryImpl: WalletRepository {
    private let remote: AccountsRemoteDataSource
    private let catalogRemote: WalletCatalogRemoteDataSource

    init(remote: AccountsRemoteDataSource, catalogRemote: WalletCatalogRemoteDataSource) {
        self.remote = remote
        self.catalogRemote = catalogRemote
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

    func fetchWallets() async throws -> [WalletSummary] {
        try await catalogRemote.fetchWallets().wallets.map { $0.toDomain() }
    }
}
