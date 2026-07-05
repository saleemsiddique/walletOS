import XCTest

@testable import WalletOS

private struct CreatedBankArgs {
    let name: String
    let icon: String?
    let color: String
}

private final class BankRepositoryStub: BankRepository, @unchecked Sendable {
    var createError: Error?
    private(set) var createdBankArgs: [CreatedBankArgs] = []
    var result = Bank(id: "bank-1", name: "Santander", icon: "🏦", color: "#007AFF", wallets: [], totalBalance: 0)

    func fetchBanks() async throws -> [Bank] { [] }

    func createBank(name: String, icon: String?, color: String) async throws -> Bank {
        createdBankArgs.append(CreatedBankArgs(name: name, icon: icon, color: color))
        if let createError { throw createError }
        return result
    }

    func archiveBank(id: String) async throws {}
}

private struct CreatedWalletArgs {
    let bankID: String
    let name: String
    let balance: Decimal
    let color: String
}

private final class WalletRepositoryStub: WalletRepository, @unchecked Sendable {
    var createError: Error?
    private(set) var createdWalletArgs: [CreatedWalletArgs] = []

    func createWallet(
        bankID: String,
        name: String,
        initialBalance: Decimal,
        color: String
    ) async throws -> Wallet {
        createdWalletArgs.append(
            CreatedWalletArgs(
                bankID: bankID, name: name, balance: initialBalance, color: color
            ))
        if let createError { throw createError }
        return Wallet(id: "wallet-1", bankID: bankID, name: name, icon: "💳", color: color, balance: initialBalance)
    }

    func fetchWallets() async throws -> [WalletSummary] { [] }

    func archiveWallet(id: String) async throws {}
}

private final class ProfileRepositoryStub: ProfileRepository, @unchecked Sendable {
    var updateError: Error?
    private(set) var timezones: [String] = []

    func updateTimezone(_ identifier: String) async throws {
        timezones.append(identifier)
        if let updateError { throw updateError }
    }
}

@MainActor
final class SetupViewModelTests: XCTestCase {
    private var banks: BankRepositoryStub!
    private var wallets: WalletRepositoryStub!
    private var profile: ProfileRepositoryStub!
    private var didFinish = false

    private func makeViewModel() -> SetupViewModel {
        SetupViewModel(
            createBank: CreateBank(repository: banks),
            createWallet: CreateWallet(repository: wallets),
            updateProfileTimezone: UpdateProfileTimezone(repository: profile),
            currentTimezone: { "Europe/Madrid" },
            onFinished: { self.didFinish = true }
        )
    }

    override func setUp() {
        super.setUp()
        banks = BankRepositoryStub()
        wallets = WalletRepositoryStub()
        profile = ProfileRepositoryStub()
        didFinish = false
    }

    override func tearDown() {
        banks = nil
        wallets = nil
        profile = nil
        super.tearDown()
    }

    func testFinishUpdatesTimezoneThenCreatesBankThenWalletAndFinishes() async {
        let viewModel = makeViewModel()
        viewModel.bankName = "Un Banco Cualquiera"
        viewModel.continueToWallet()
        viewModel.walletName = "Nómina"
        viewModel.initialBalance = 1250

        await viewModel.finish()

        XCTAssertEqual(profile.timezones, ["Europe/Madrid"])
        XCTAssertEqual(banks.createdBankArgs.count, 1)
        XCTAssertEqual(wallets.createdWalletArgs.count, 1)
        XCTAssertEqual(wallets.createdWalletArgs.first?.bankID, "bank-1")
        XCTAssertEqual(wallets.createdWalletArgs.first?.name, "Nómina")
        XCTAssertEqual(wallets.createdWalletArgs.first?.balance, 1250)
        XCTAssertTrue(didFinish)
    }

    func testCustomBankNameSendsNoIconAndLetsTheBackendDefault() async {
        let viewModel = makeViewModel()
        viewModel.bankName = "Un Banco Cualquiera"
        viewModel.continueToWallet()
        viewModel.walletName = "Ahorro"

        await viewModel.finish()

        XCTAssertNil(banks.createdBankArgs.first?.icon)
    }

    func testSelectingACatalogSuggestionSendsItsKeyAsTheIcon() async throws {
        let viewModel = makeViewModel()
        viewModel.bankName = "bbva"
        let match = try XCTUnwrap(viewModel.bankSuggestions.first { $0.key == "bbva" })
        viewModel.selectBank(match)
        viewModel.continueToWallet()
        viewModel.walletName = "Ahorro"

        await viewModel.finish()

        XCTAssertEqual(banks.createdBankArgs.first?.icon, "bbva")
        XCTAssertEqual(viewModel.bankName, "BBVA")
    }

    func testEditingTheNameAfterPickingASuggestionClearsTheSelection() async throws {
        let viewModel = makeViewModel()
        viewModel.bankName = "bbva"
        let match = try XCTUnwrap(viewModel.bankSuggestions.first { $0.key == "bbva" })
        viewModel.selectBank(match)
        XCTAssertTrue(viewModel.bankSuggestions.isEmpty, "tras aceptar una sugerencia, no se ofrecen más")

        // Seguir escribiendo tras aceptar una sugerencia deshace la selección: el icono ya no
        // debe ser el del catálogo, aunque el nombre siga empezando igual.
        viewModel.bankName = "BBVA pero otro banco"
        viewModel.continueToWallet()
        viewModel.walletName = "Ahorro"
        await viewModel.finish()

        XCTAssertNil(banks.createdBankArgs.first?.icon)
    }

    func testBankCreationFailureDoesNotCreateWallet() async {
        banks.createError = APIError.server(status: 500)
        let viewModel = makeViewModel()
        viewModel.bankName = "Santander"
        viewModel.continueToWallet()
        viewModel.walletName = "Nómina"

        await viewModel.finish()

        XCTAssertTrue(wallets.createdWalletArgs.isEmpty)
        XCTAssertFalse(didFinish)
        XCTAssertEqual(viewModel.status, .error("No se pudo completar la configuración. Inténtalo de nuevo."))
    }

    func testRetryAfterWalletFailureDoesNotDuplicateTheBank() async {
        wallets.createError = APIError.offline
        let viewModel = makeViewModel()
        viewModel.bankName = "Santander"
        viewModel.continueToWallet()
        viewModel.walletName = "Nómina"

        await viewModel.finish()
        XCTAssertEqual(banks.createdBankArgs.count, 1)
        XCTAssertFalse(didFinish)

        wallets.createError = nil
        await viewModel.finish()

        XCTAssertEqual(banks.createdBankArgs.count, 1, "el banco no debe recrearse al reintentar")
        XCTAssertEqual(wallets.createdWalletArgs.count, 2)
        XCTAssertTrue(didFinish)
    }

    func testTimezoneFailureDoesNotBlockAccountCreation() async {
        profile.updateError = APIError.offline
        let viewModel = makeViewModel()
        viewModel.bankName = "Santander"
        viewModel.continueToWallet()
        viewModel.walletName = "Nómina"

        await viewModel.finish()

        XCTAssertEqual(banks.createdBankArgs.count, 1)
        XCTAssertEqual(wallets.createdWalletArgs.count, 1)
        XCTAssertTrue(didFinish)
    }

    func testCannotContinueFromBankWithoutName() {
        let viewModel = makeViewModel()
        XCTAssertFalse(viewModel.canContinueFromBank)

        viewModel.continueToWallet()
        XCTAssertEqual(viewModel.step, .bank)

        viewModel.bankName = "  "
        XCTAssertFalse(viewModel.canContinueFromBank)
    }

    func testCannotFinishWithoutWalletName() {
        let viewModel = makeViewModel()
        viewModel.bankName = "Santander"
        viewModel.continueToWallet()
        XCTAssertFalse(viewModel.canFinish)
    }
}
