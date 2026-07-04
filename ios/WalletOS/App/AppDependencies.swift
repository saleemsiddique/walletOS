import Foundation

/// Raíz de composición: construye una sola vez la infraestructura compartida (sesión, red)
/// y fabrica las dependencias que cada feature necesita.
@MainActor
final class AppDependencies {
    let authState: AuthState
    let tokenStore: TokenStore
    private let authRepository: AuthRepository

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
}
