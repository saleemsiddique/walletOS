import Foundation

/// Implementación de `DashboardRepository`: intenta el remoto y cachea en éxito; sin red
/// (`APIError.offline`), sirve el último dashboard cacheado con su timestamp de sincronización.
final class DashboardRepositoryImpl: DashboardRepository {
    private let remote: DashboardRemoteDataSource
    private let local: DashboardSnapshotLocalDataSource

    init(remote: DashboardRemoteDataSource, local: DashboardSnapshotLocalDataSource) {
        self.remote = remote
        self.local = local
    }

    func fetchDashboard() async throws -> DashboardSnapshot {
        do {
            let snapshot = try await remote.fetchDashboard().toDomain()
            try? await cache(snapshot)
            return snapshot
        } catch APIError.offline {
            guard let record = try? await local.fetch(), let cached = record.toDomain() else {
                throw APIError.offline
            }
            return cached
        }
    }

    private func cache(_ snapshot: DashboardSnapshot) async throws {
        let record = try DashboardSnapshotRecord(snapshot: snapshot, syncedAt: Date())
        try await local.upsert(record)
    }
}
