import Foundation

/// Implementación de `BankRepository`: delega en el data source remoto y mapea DTO → dominio.
final class BankRepositoryImpl: BankRepository {
    private let remote: AccountsRemoteDataSource

    init(remote: AccountsRemoteDataSource) {
        self.remote = remote
    }

    func fetchBanks() async throws -> [Bank] {
        try await remote.fetchBanks().banks.map { $0.toDomain() }
    }

    func createBank(name: String, icon: String?, color: String) async throws -> Bank {
        try await remote.createBank(name: name, icon: icon, color: color).toDomain()
    }
}
