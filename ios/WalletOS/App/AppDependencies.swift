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
    private let categoryRepository: CategoryRepository
    private let categorizationRepository: CategorizationRepository
    private let syncQueue: SyncQueue

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
        let database = try! AppDatabase.openInApplicationSupport()
        let accountsRemote = AccountsRemoteDataSource(client: apiClient)
        let walletCatalogRemote = WalletCatalogRemoteDataSource(client: apiClient)
        let transactionRemote = TransactionRemoteDataSource(client: apiClient)
        self.bankRepository = BankRepositoryImpl(
            remote: accountsRemote,
            bankLocal: BankLocalDataSource(database: database),
            walletLocal: WalletLocalDataSource(database: database)
        )
        self.walletRepository = WalletRepositoryImpl(
            remote: accountsRemote, catalogRemote: walletCatalogRemote)
        self.profileRepository = ProfileRepositoryImpl(
            remote: ProfileRemoteDataSource(client: apiClient)
        )
        self.dashboardRepository = DashboardRepositoryImpl(
            remote: DashboardRemoteDataSource(client: apiClient),
            local: DashboardSnapshotLocalDataSource(database: database)
        )
        self.transactionRepository = TransactionRepositoryImpl(remote: transactionRemote)
        self.categoryRepository = CategoryRepositoryImpl(remote: walletCatalogRemote)
        self.categorizationRepository = CategorizationRepositoryImpl(remote: walletCatalogRemote)

        // Cola offline-first (Rama 7): su handler traduce cada operación a la llamada remota; drena
        // automáticamente al recuperar conectividad. Se cablea aquí (diferido de la Rama 15).
        let syncQueue = SyncQueue(
            database: database,
            handler: TransactionSyncHandler(remote: transactionRemote)
        )
        self.syncQueue = syncQueue
        let networkMonitor = NetworkMonitor()
        Task { await syncQueue.observeConnectivity(networkMonitor) }
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
        AccountsViewModel(
            bankRepository: bankRepository,
            archiveBank: ArchiveBank(repository: bankRepository),
            archiveWallet: ArchiveWallet(repository: walletRepository)
        )
    }

    func makeTransactionModalViewModel(onSaved: @escaping () -> Void) -> TransactionModalViewModel {
        TransactionModalViewModel(
            createTransaction: CreateTransaction(syncQueue: syncQueue),
            createTransfer: CreateTransfer(repository: transactionRepository),
            fetchWallets: FetchWalletsForPicker(repository: walletRepository),
            fetchCategories: FetchCategories(repository: categoryRepository),
            suggestCategory: SuggestCategory(repository: categorizationRepository),
            onSaved: onSaved
        )
    }

    func makeEditTransactionModalViewModel(
        transactionId: String,
        onSaved: @escaping () -> Void,
        onDelete: @escaping () -> Void
    ) -> TransactionModalViewModel {
        TransactionModalViewModel(
            createTransaction: CreateTransaction(syncQueue: syncQueue),
            createTransfer: CreateTransfer(repository: transactionRepository),
            fetchWallets: FetchWalletsForPicker(repository: walletRepository),
            fetchCategories: FetchCategories(repository: categoryRepository),
            suggestCategory: SuggestCategory(repository: categorizationRepository),
            editing: TransactionModalViewModel.EditingDependencies(
                transactionId: transactionId,
                fetchTransaction: FetchTransaction(repository: transactionRepository),
                updateTransaction: UpdateTransaction(repository: transactionRepository),
                onDelete: onDelete
            ),
            onSaved: onSaved
        )
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
