import AuthenticationServices
import GoogleSignIn
import XCTest

@testable import WalletOS

/// Repositorio de auth controlable desde los tests del ViewModel.
private final class AuthRepositoryStub: AuthRepository, @unchecked Sendable {
    struct RegisterCall: Equatable {
        let email: String
        let password: String
        let name: String
    }

    struct AppleCall: Equatable {
        let identityToken: String
        let name: String?
    }

    struct GoogleCall: Equatable {
        let idToken: String
        let name: String?
    }

    var loginError: Error?
    var registerError: Error?
    var appleError: Error?
    var googleError: Error?
    private(set) var loginCalls: [(email: String, password: String)] = []
    private(set) var registerCalls: [RegisterCall] = []
    private(set) var appleCalls: [AppleCall] = []
    private(set) var googleCalls: [GoogleCall] = []

    func login(email: String, password: String) async throws {
        loginCalls.append((email, password))
        if let loginError { throw loginError }
    }

    func register(email: String, password: String, name: String) async throws {
        registerCalls.append(RegisterCall(email: email, password: password, name: name))
        if let registerError { throw registerError }
    }

    func signInWithApple(identityToken: String, name: String?) async throws {
        appleCalls.append(AppleCall(identityToken: identityToken, name: name))
        if let appleError { throw appleError }
    }

    func signInWithGoogle(idToken: String, name: String?) async throws {
        googleCalls.append(GoogleCall(idToken: idToken, name: name))
        if let googleError { throw googleError }
    }

    func requestPasswordReset(email: String) async throws {}
    func resetPassword(token: String, newPassword: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}

@MainActor
final class AuthViewModelTests: XCTestCase {
    private var repository: AuthRepositoryStub!
    private var viewModel: AuthViewModel!

    override func setUp() {
        super.setUp()
        repository = AuthRepositoryStub()
        viewModel = AuthViewModel(
            loginUser: LoginUser(repository: repository),
            registerUser: RegisterUser(repository: repository),
            appleSignIn: SignInWithApple(repository: repository),
            googleSignIn: SignInWithGoogle(repository: repository)
        )
    }

    override func tearDown() {
        viewModel = nil
        repository = nil
        super.tearDown()
    }

    private func fillValidLoginForm() {
        viewModel.email = "ana@mail.com"
        viewModel.password = "12345678"
    }

    func testInvalidEmailBlocksSubmit() async {
        viewModel.email = "no-es-un-email"
        viewModel.password = "12345678"

        XCTAssertFalse(viewModel.canSubmit)
        await viewModel.submit()
        XCTAssertTrue(repository.loginCalls.isEmpty)
    }

    func testShortPasswordBlocksSubmit() {
        viewModel.email = "ana@mail.com"
        viewModel.password = "corta"

        XCTAssertFalse(viewModel.canSubmit)
    }

    func testRegisterModeRequiresAName() {
        viewModel.mode = .register
        fillValidLoginForm()

        XCTAssertFalse(viewModel.canSubmit)
        viewModel.name = "Ana"
        XCTAssertTrue(viewModel.canSubmit)
    }

    func testSuccessfulLoginCallsTheRepositoryAndEndsIdle() async {
        fillValidLoginForm()

        await viewModel.submit()

        XCTAssertEqual(repository.loginCalls.count, 1)
        XCTAssertEqual(repository.loginCalls.first?.email, "ana@mail.com")
        XCTAssertEqual(viewModel.status, .idle)
    }

    func testUnauthorizedLoginShowsAnErrorMessage() async {
        repository.loginError = APIError.unauthorized
        fillValidLoginForm()

        await viewModel.submit()

        XCTAssertEqual(viewModel.status, .error("Email o contraseña incorrectos."))
    }

    func testTogglingModeResetsTheErrorState() async {
        repository.loginError = APIError.unauthorized
        fillValidLoginForm()
        await viewModel.submit()

        viewModel.mode = .register

        XCTAssertEqual(viewModel.status, .idle)
    }

    func testAppleSignInCallsTheRepositoryWithTokenAndName() async {
        await viewModel.signInWithApple(identityToken: "jwt-apple", name: "Ana García")

        XCTAssertEqual(viewModel.status, .idle)
        XCTAssertEqual(repository.appleCalls.count, 1)
        XCTAssertEqual(repository.appleCalls.first?.identityToken, "jwt-apple")
        XCTAssertEqual(repository.appleCalls.first?.name, "Ana García")
    }

    func testAppleCancellationDoesNotProduceAnErrorState() {
        viewModel.handleAppleFailure(ASAuthorizationError(.canceled))

        XCTAssertEqual(viewModel.status, .idle)
    }

    func testAppleFailureOtherThanCancellationShowsAnError() {
        viewModel.handleAppleFailure(ASAuthorizationError(.failed))

        XCTAssertEqual(viewModel.status, .error("No se pudo iniciar sesión con Apple. Inténtalo de nuevo."))
    }

    func testAppleBackendRejectionShowsAppleSpecificMessage() async {
        repository.appleError = APIError.unauthorized

        await viewModel.signInWithApple(identityToken: "jwt-invalido", name: nil)

        XCTAssertEqual(viewModel.status, .error("No se pudo validar tu cuenta de Apple. Inténtalo de nuevo."))
    }

    func testGoogleSignInCallsTheRepositoryWithTokenAndName() async {
        await viewModel.signInWithGoogle(idToken: "jwt-google", name: "Ana García")

        XCTAssertEqual(viewModel.status, .idle)
        XCTAssertEqual(repository.googleCalls.count, 1)
        XCTAssertEqual(repository.googleCalls.first?.idToken, "jwt-google")
        XCTAssertEqual(repository.googleCalls.first?.name, "Ana García")
    }

    func testGoogleCancellationDoesNotProduceAnErrorState() {
        let cancellation = NSError(domain: kGIDSignInErrorDomain, code: GIDSignInError.canceled.rawValue)

        viewModel.handleGoogleFailure(cancellation)

        XCTAssertEqual(viewModel.status, .idle)
    }

    func testGoogleFailureOtherThanCancellationShowsAnError() {
        viewModel.handleGoogleFailure(URLError(.badServerResponse))

        XCTAssertEqual(viewModel.status, .error("No se pudo iniciar sesión con Google. Inténtalo de nuevo."))
    }

    func testGoogleBackendRejectionShowsGoogleSpecificMessage() async {
        repository.googleError = APIError.unauthorized

        await viewModel.signInWithGoogle(idToken: "jwt-invalido", name: nil)

        XCTAssertEqual(viewModel.status, .error("No se pudo validar tu cuenta de Google. Inténtalo de nuevo."))
    }
}
