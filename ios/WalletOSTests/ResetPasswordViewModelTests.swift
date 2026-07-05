import XCTest

@testable import WalletOS

/// Repositorio controlable para el flujo de reset.
private final class ResetRepositoryStub: AuthRepository, @unchecked Sendable {
    struct ResetCall: Equatable {
        let token: String
        let newPassword: String
    }

    var resetError: Error?
    private(set) var resetCalls: [ResetCall] = []

    func resetPassword(token: String, newPassword: String) async throws {
        resetCalls.append(ResetCall(token: token, newPassword: newPassword))
        if let resetError { throw resetError }
    }

    func register(email: String, password: String, name: String) async throws {}
    func login(email: String, password: String) async throws {}
    func signInWithApple(identityToken: String, name: String?) async throws {}
    func signInWithGoogle(idToken: String, name: String?) async throws {}
    func requestPasswordReset(email: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}

@MainActor
final class ResetPasswordViewModelTests: XCTestCase {
    private var repository: ResetRepositoryStub!
    private var viewModel: ResetPasswordViewModel!

    override func setUp() {
        super.setUp()
        repository = ResetRepositoryStub()
        viewModel = ResetPasswordViewModel(
            token: "token-abc",
            resetPassword: ResetPassword(repository: repository)
        )
    }

    override func tearDown() {
        viewModel = nil
        repository = nil
        super.tearDown()
    }

    func testSuccessfulResetSendsTokenAndPassword() async {
        viewModel.newPassword = "nueva-clave-1"
        viewModel.confirmation = "nueva-clave-1"

        await viewModel.submit()

        XCTAssertEqual(repository.resetCalls, [.init(token: "token-abc", newPassword: "nueva-clave-1")])
        XCTAssertEqual(viewModel.status, .success)
    }

    func testMismatchedConfirmationBlocksSubmit() async {
        viewModel.newPassword = "nueva-clave-1"
        viewModel.confirmation = "distinta-clave"

        XCTAssertFalse(viewModel.canSubmit)
        await viewModel.submit()
        XCTAssertTrue(repository.resetCalls.isEmpty)
    }

    func testShortPasswordBlocksSubmit() {
        viewModel.newPassword = "corta"
        viewModel.confirmation = "corta"

        XCTAssertFalse(viewModel.canSubmit)
    }

    func testExpiredTokenShowsErrorAndOffersRequestingANewLink() async {
        repository.resetError = APIError.validation(details: nil)
        viewModel.newPassword = "nueva-clave-1"
        viewModel.confirmation = "nueva-clave-1"

        await viewModel.submit()

        XCTAssertTrue(viewModel.isTokenInvalid)
        XCTAssertEqual(viewModel.status, .error("El enlace no es válido o ha caducado. Solicita uno nuevo."))
    }
}
