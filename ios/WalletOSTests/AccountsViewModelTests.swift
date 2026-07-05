import XCTest

@testable import WalletOS

private final class BankRepositoryStub: BankRepository, @unchecked Sendable {
    var banks: [Bank] = []
    private(set) var archivedBankIds: [String] = []

    func fetchBanks() async throws -> [Bank] { banks }
    func createBank(name: String, icon: String?, color: String) async throws -> Bank {
        Bank(id: "b", name: name, icon: icon ?? "🏦", color: color, wallets: [], totalBalance: 0)
    }
    func archiveBank(id: String) async throws { archivedBankIds.append(id) }
}

private final class WalletRepositoryStub: WalletRepository, @unchecked Sendable {
    private(set) var archivedWalletIds: [String] = []

    func createWallet(bankID: String, name: String, initialBalance: Decimal, color: String) async throws -> Wallet {
        Wallet(id: "w", bankID: bankID, name: name, icon: "💳", color: color, balance: initialBalance)
    }
    func fetchWallets() async throws -> [WalletSummary] { [] }
    func archiveWallet(id: String) async throws { archivedWalletIds.append(id) }
}

@MainActor
final class AccountsViewModelTests: XCTestCase {
    private var banks: BankRepositoryStub!
    private var wallets: WalletRepositoryStub!

    private func makeViewModel() -> AccountsViewModel {
        AccountsViewModel(
            bankRepository: banks,
            archiveBank: ArchiveBank(repository: banks),
            archiveWallet: ArchiveWallet(repository: wallets)
        )
    }

    override func setUp() {
        super.setUp()
        banks = BankRepositoryStub()
        wallets = WalletRepositoryStub()
    }

    override func tearDown() {
        banks = nil
        wallets = nil
        super.tearDown()
    }

    func testLoadPublishesTheBanks() async {
        banks.banks = [
            Bank(id: "b1", name: "Santander", icon: "🏦", color: "#000", wallets: [], totalBalance: 300)
        ]
        let viewModel = makeViewModel()

        await viewModel.load()

        XCTAssertEqual(viewModel.state, .loaded(banks.banks))
    }

    func testArchiveBankCallsRepositoryAndReloads() async {
        banks.banks = [Bank(id: "b1", name: "N26", icon: "🏦", color: "#000", wallets: [], totalBalance: 0)]
        let viewModel = makeViewModel()
        await viewModel.load()

        await viewModel.archive(bankId: "b1")

        XCTAssertEqual(banks.archivedBankIds, ["b1"])
    }

    func testArchiveWalletCallsRepositoryAndReloads() async {
        let viewModel = makeViewModel()

        await viewModel.archive(walletId: "w7")

        XCTAssertEqual(wallets.archivedWalletIds, ["w7"])
    }
}
