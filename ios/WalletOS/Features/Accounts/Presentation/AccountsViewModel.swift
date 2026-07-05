import Foundation

/// ViewModel de `AccountsView` ("ver todas" desde Patrimonio): lista bancos con sus wallets y
/// permite archivarlos (soft delete). Crear/editar banco o wallet llega en las Ramas 19-20.
@MainActor
final class AccountsViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case loaded([Bank])
        case failed
    }

    @Published private(set) var state: State = .loading

    private let bankRepository: BankRepository
    private let archiveBank: ArchiveBank
    private let archiveWallet: ArchiveWallet

    init(bankRepository: BankRepository, archiveBank: ArchiveBank, archiveWallet: ArchiveWallet) {
        self.bankRepository = bankRepository
        self.archiveBank = archiveBank
        self.archiveWallet = archiveWallet
    }

    func load() async {
        state = .loading
        do {
            state = .loaded(try await bankRepository.fetchBanks())
        } catch {
            state = .failed
        }
    }

    func archive(bankId: String) async {
        try? await archiveBank.execute(id: bankId)
        await load()
    }

    func archive(walletId: String) async {
        try? await archiveWallet.execute(id: walletId)
        await load()
    }
}
