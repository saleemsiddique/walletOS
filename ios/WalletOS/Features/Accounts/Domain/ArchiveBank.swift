/// Caso de uso: archivar un banco (soft delete; arrastra sus wallets, conserva transacciones).
struct ArchiveBank {
    private let repository: BankRepository

    init(repository: BankRepository) {
        self.repository = repository
    }

    func execute(id: String) async throws {
        try await repository.archiveBank(id: id)
    }
}
