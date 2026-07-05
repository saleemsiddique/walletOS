import Foundation

/// Implementación de `DashboardRepository`: delega en el data source remoto y mapea DTO → dominio.
/// El fallback a cache offline llega en un commit posterior de esta misma rama.
final class DashboardRepositoryImpl: DashboardRepository {
    private let remote: DashboardRemoteDataSource

    init(remote: DashboardRemoteDataSource) {
        self.remote = remote
    }

    func fetchDashboard() async throws -> DashboardSnapshot {
        try await remote.fetchDashboard().toDomain()
    }
}
