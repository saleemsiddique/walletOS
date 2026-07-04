import XCTest

@testable import WalletOS

/// Repositorio controlable para el flujo de forgot.
private final class ForgotRepositoryStub: AuthRepository, @unchecked Sendable {
    var forgotError: Error?
    private(set) var forgotCalls: [String] = []

    func requestPasswordReset(email: String) async throws {
        forgotCalls.append(email)
        if let forgotError { throw forgotError }
    }

    func register(email: String, password: String, name: String) async throws {}
    func login(email: String, password: String) async throws {}
    func signInWithApple(identityToken: String, name: String?) async throws {}
    func signInWithGoogle(idToken: String, name: String?) async throws {}
    func resetPassword(token: String, newPassword: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}

@MainActor
final class ForgotPasswordViewModelTests: XCTestCase {
    private var repository: ForgotRepositoryStub!
    private var viewModel: ForgotPasswordViewModel!

    override func setUp() {
        super.setUp()
        repository = ForgotRepositoryStub()
        viewModel = ForgotPasswordViewModel(
            requestPasswordReset: RequestPasswordReset(repository: repository)
        )
    }

    override func tearDown() {
        viewModel = nil
        repository = nil
        super.tearDown()
    }

    func testSubmitSendsTheRequestAndShowsTheNeutralMessage() async {
        viewModel.email = "ana@mail.com"

        await viewModel.submit()

        XCTAssertEqual(repository.forgotCalls, ["ana@mail.com"])
        XCTAssertEqual(viewModel.status, .sent)
    }

    func testInvalidEmailBlocksSubmit() async {
        viewModel.email = "no-es-un-email"

        XCTAssertFalse(viewModel.canSubmit)
        await viewModel.submit()
        XCTAssertTrue(repository.forgotCalls.isEmpty)
    }

    func testNetworkFailureShowsAnErrorInsteadOfTheNeutralMessage() async {
        repository.forgotError = APIError.offline
        viewModel.email = "ana@mail.com"

        await viewModel.submit()

        XCTAssertEqual(viewModel.status, .error("Sin conexión. Inténtalo cuando vuelvas a tener red."))
    }
}
