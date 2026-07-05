import Foundation

/// ViewModel de `AccountsView` ("ver todas" desde Patrimonio). Solo lectura por ahora — crear/
/// editar/archivar banco o wallet llega en las Ramas 18-20 (ver `docs/phase-10-ios-app.md`).
@MainActor
final class AccountsViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case loaded([Bank])
        case failed
    }

    @Published private(set) var state: State = .loading

    private let bankRepository: BankRepository

    init(bankRepository: BankRepository) {
        self.bankRepository = bankRepository
    }

    func load() async {
        state = .loading
        do {
            state = .loaded(try await bankRepository.fetchBanks())
        } catch {
            state = .failed
        }
    }
}
