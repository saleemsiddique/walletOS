import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case loaded(DashboardSnapshot)
        case failed
    }

    @Published private(set) var state: State = .loading
    @Published var isBalanceRedacted = false

    private let fetchDashboard: FetchDashboard

    init(fetchDashboard: FetchDashboard) {
        self.fetchDashboard = fetchDashboard
    }

    func load() async {
        state = .loading
        do {
            state = .loaded(try await fetchDashboard.execute())
        } catch {
            state = .failed
        }
    }

    func toggleBalanceRedacted() {
        isBalanceRedacted.toggle()
    }
}
