/// Caso de uso: wallets planos para los selectores del modal de transacción.
struct FetchWalletsForPicker {
    private let repository: WalletRepository

    init(repository: WalletRepository) {
        self.repository = repository
    }

    func execute() async throws -> [WalletSummary] {
        try await repository.fetchWallets()
    }
}
