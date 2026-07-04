import XCTest

@testable import WalletOS

/// Repositorio de auth controlable desde los tests del ViewModel.
private final class AuthRepositoryStub: AuthRepository, @unchecked Sendable {
    struct RegisterCall: Equatable {
        let email: String
        let password: String
        let name: String
    }

    var loginError: Error?
    var registerError: Error?
    private(set) var loginCalls: [(email: String, password: String)] = []
    private(set) var registerCalls: [RegisterCall] = []

    func login(email: String, password: String) async throws {
        loginCalls.append((email, password))
        if let loginError { throw loginError }
    }

    func register(email: String, password: String, name: String) async throws {
        registerCalls.append(RegisterCall(email: email, password: password, name: name))
        if let registerError { throw registerError }
    }

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
            registerUser: RegisterUser(repository: repository)
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

    func testEmailTakenOnRegisterOffersSwitchingToLoginKeepingTheEmail() async {
        repository.registerError = APIError.conflict(details: nil)
        viewModel.mode = .register
        fillValidLoginForm()
        viewModel.name = "Ana"

        await viewModel.submit()

        XCTAssertEqual(viewModel.status, .error("Ese email ya está registrado."))
        XCTAssertTrue(viewModel.isEmailTakenError)
        viewModel.mode = .login
        XCTAssertFalse(viewModel.isEmailTakenError)
        XCTAssertEqual(viewModel.email, "ana@mail.com")
    }

    func testEachFailedSubmitIncrementsTheShakeCounter() async {
        repository.loginError = APIError.unauthorized
        fillValidLoginForm()

        await viewModel.submit()
        await viewModel.submit()

        XCTAssertEqual(viewModel.failedAttempts, 2)
    }

    func testConnectionErrorFlagDistinguishesServerProblemsFromBadCredentials() async {
        fillValidLoginForm()

        repository.loginError = APIError.server(status: 500)
        await viewModel.submit()
        XCTAssertTrue(viewModel.hasConnectionError)

        repository.loginError = APIError.unauthorized
        await viewModel.submit()
        XCTAssertFalse(viewModel.hasConnectionError)
    }

    func testGoingOfflineDisablesSubmitAndComingBackReenablesIt() async {
        let monitor = NetworkMonitoringStub()
        viewModel = AuthViewModel(
            loginUser: LoginUser(repository: repository),
            registerUser: RegisterUser(repository: repository),
            networkMonitor: monitor
        )
        fillValidLoginForm()

        monitor.send(isConnected: false)
        await waitUntil { self.viewModel.isOffline }
        XCTAssertTrue(viewModel.isOffline)
        XCTAssertFalse(viewModel.canSubmit)

        monitor.send(isConnected: true)
        await waitUntil { !self.viewModel.isOffline }
        XCTAssertFalse(viewModel.isOffline)
        XCTAssertTrue(viewModel.canSubmit)
    }

    /// Espera acotada a que el `Task` interno del ViewModel consuma el evento del stream.
    private func waitUntil(timeout: TimeInterval = 1, _ condition: () -> Bool) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition(), Date() < deadline {
            await Task.yield()
            try? await Task.sleep(nanoseconds: 5_000_000)
        }
    }
}

/// Monitor de red controlable desde los tests.
private final class NetworkMonitoringStub: NetworkMonitoring, @unchecked Sendable {
    private var continuation: AsyncStream<Bool>.Continuation?
    private let stream: AsyncStream<Bool>

    init() {
        var continuation: AsyncStream<Bool>.Continuation?
        stream = AsyncStream { continuation = $0 }
        self.continuation = continuation
    }

    func pathUpdates() -> AsyncStream<Bool> {
        stream
    }

    func send(isConnected: Bool) {
        continuation?.yield(isConnected)
    }
}
