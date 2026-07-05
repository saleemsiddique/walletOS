/// Caso de uso: archivar un wallet (soft delete; conserva sus transacciones).
struct ArchiveWallet {
    private let repository: WalletRepository

    init(repository: WalletRepository) {
        self.repository = repository
    }

    func execute(id: String) async throws {
        try await repository.archiveWallet(id: id)
    }
}
