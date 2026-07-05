import Foundation

/// Raíz de composición: construye una sola vez la infraestructura compartida (sesión, red)
/// y fabrica las dependencias que cada feature necesita.
@MainActor
final class AppDependencies {
    let authState: AuthState
    let tokenStore: TokenStore
    private let authRepository: AuthRepository
    private let bankRepository: BankRepository
    private let walletRepository: WalletRepository
    private let profileRepository: ProfileRepository
    private let dashboardRepository: DashboardRepository
    private let transactionRepository: TransactionRepository

    init() {
        let authState = AuthState()
        let tokenStore = TokenStore(
            secureStore: KeychainStore(service: "com.walletOS.app"),
            authState: authState
        )
        let interceptor = AuthInterceptor(
            tokenStore: tokenStore,
            session: .shared,
            baseURL: AppEnvironment.current.baseURL,
            onLogout: { Task { await tokenStore.clear() } }
        )
        let apiClient = APIClient(interceptor: interceptor)
        self.authState = authState
        self.tokenStore = tokenStore
        self.authRepository = AuthRepositoryImpl(
            remote: AuthRemoteDataSource(client: apiClient),
            tokenStore: tokenStore
        )
        let accountsRemote = AccountsRemoteDataSource(client: apiClient)
        self.bankRepository = BankRepositoryImpl(remote: accountsRemote)
        self.walletRepository = WalletRepositoryImpl(remote: accountsRemote)
        self.profileRepository = ProfileRepositoryImpl(
            remote: ProfileRemoteDataSource(client: apiClient)
        )
        self.dashboardRepository = DashboardRepositoryImpl(
            remote: DashboardRemoteDataSource(client: apiClient)
        )
        self.transactionRepository = TransactionRepositoryImpl(
            remote: TransactionRemoteDataSource(client: apiClient)
        )
    }

    func makeAuthViewModel() -> AuthViewModel {
        AuthViewModel(
            loginUser: LoginUser(repository: authRepository),
            registerUser: RegisterUser(repository: authRepository),
            appleSignIn: SignInWithApple(repository: authRepository),
            googleSignIn: SignInWithGoogle(repository: authRepository)
        )
    }

    func makeForgotPasswordViewModel() -> ForgotPasswordViewModel {
        ForgotPasswordViewModel(requestPasswordReset: RequestPasswordReset(repository: authRepository))
    }

    func makeResetPasswordViewModel(token: String) -> ResetPasswordViewModel {
        ResetPasswordViewModel(token: token, resetPassword: ResetPassword(repository: authRepository))
    }

    func makeAuthenticatedRouterViewModel() -> AuthenticatedRouterViewModel {
        AuthenticatedRouterViewModel(bankRepository: bankRepository)
    }

    func makeHomeViewModel() -> HomeViewModel {
        HomeViewModel(
            fetchDashboard: FetchDashboard(repository: dashboardRepository),
            bankRepository: bankRepository,
            deleteTransaction: DeleteTransaction(repository: transactionRepository)
        )
    }

    func makeAccountsViewModel() -> AccountsViewModel {
        AccountsViewModel(bankRepository: bankRepository)
    }

    func makeSetupViewModel(onFinished: @escaping () -> Void) -> SetupViewModel {
        SetupViewModel(
            createBank: CreateBank(repository: bankRepository),
            createWallet: CreateWallet(repository: walletRepository),
            updateProfileTimezone: UpdateProfileTimezone(repository: profileRepository),
            onFinished: onFinished
        )
    }
}
