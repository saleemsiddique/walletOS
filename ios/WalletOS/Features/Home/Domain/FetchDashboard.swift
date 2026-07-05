/// Caso de uso: obtener el dashboard de Patrimonio.
struct FetchDashboard {
    private let repository: DashboardRepository

    init(repository: DashboardRepository) {
        self.repository = repository
    }

    func execute() async throws -> DashboardSnapshot {
        try await repository.fetchDashboard()
    }
}
