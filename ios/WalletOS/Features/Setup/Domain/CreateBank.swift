/// Caso de uso: crear un banco durante el setup inicial.
struct CreateBank {
    private let repository: BankRepository

    init(repository: BankRepository) {
        self.repository = repository
    }

    func execute(name: String, icon: String?, color: String) async throws -> Bank {
        try await repository.createBank(name: name, icon: icon, color: color)
    }
}
