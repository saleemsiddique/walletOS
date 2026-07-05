import Foundation

/// Implementación de `ProfileRepository` sobre el data source remoto de perfil.
final class ProfileRepositoryImpl: ProfileRepository {
    private let remote: ProfileRemoteDataSource

    init(remote: ProfileRemoteDataSource) {
        self.remote = remote
    }

    func updateTimezone(_ identifier: String) async throws {
        try await remote.updateTimezone(identifier)
    }
}
