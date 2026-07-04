import AuthenticationServices
import Foundation
import GoogleSignIn

/// Estado y acciones de la pantalla de auth: alterna Login/Registro, valida email/contraseña
/// y ejecuta el caso de uso correspondiente (email+password, Apple o Google). El éxito no navega
/// desde aquí: la sesión queda guardada y la vista raíz reacciona al `AuthState` (gancho Setup
/// vs Home, Rama 14).
@MainActor
final class AuthViewModel: ObservableObject {
    enum Mode: Equatable {
        case login
        case register
    }

    enum Status: Equatable {
        case idle
        case loading
        case error(String)
    }

    @Published var mode: Mode = .login {
        didSet { status = .idle }
    }
    @Published var name = ""
    @Published var email = ""
    @Published var password = ""
    @Published private(set) var status: Status = .idle

    private let loginUser: LoginUser
    private let registerUser: RegisterUser
    private let appleSignIn: SignInWithApple
    private let googleSignIn: SignInWithGoogle

    init(
        loginUser: LoginUser,
        registerUser: RegisterUser,
        appleSignIn: SignInWithApple,
        googleSignIn: SignInWithGoogle
    ) {
        self.loginUser = loginUser
        self.registerUser = registerUser
        self.appleSignIn = appleSignIn
        self.googleSignIn = googleSignIn
    }

    var isEmailValid: Bool {
        email.range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil
    }

    /// Mínimo del backend (`POST /register`): 8 caracteres.
    var isPasswordValid: Bool {
        password.count >= 8
    }

    var isNameValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var canSubmit: Bool {
        guard status != .loading else { return false }
        let hasValidCredentials = isEmailValid && isPasswordValid
        switch mode {
        case .login: return hasValidCredentials
        case .register: return hasValidCredentials && isNameValid
        }
    }

    func submit() async {
        guard canSubmit else { return }
        status = .loading
        do {
            switch mode {
            case .login:
                try await loginUser.execute(email: email, password: password)
            case .register:
                try await registerUser.execute(email: email, password: password, name: name)
            }
            status = .idle
        } catch {
            status = .error(Self.message(for: error))
        }
    }

    /// Canjea la credencial de Apple ya extraída. La extracción vive en la vista (es quien
    /// habla con `AuthenticationServices`); aquí solo el estado y el caso de uso.
    func signInWithApple(identityToken: String, name: String?) async {
        guard status != .loading else { return }
        status = .loading
        do {
            try await appleSignIn.execute(identityToken: identityToken, name: name)
            status = .idle
        } catch {
            status = .error(Self.appleMessage(for: error))
        }
    }

    /// Fallo del flujo de Apple antes de llegar al backend. Cancelar no es un error:
    /// la pantalla queda como estaba.
    func handleAppleFailure(_ error: Error) {
        if let authorizationError = error as? ASAuthorizationError, authorizationError.code == .canceled {
            return
        }
        status = .error("No se pudo iniciar sesión con Apple. Inténtalo de nuevo.")
    }

    /// Canjea el `id_token` de Google ya extraído. La interacción con el SDK vive en la vista.
    func signInWithGoogle(idToken: String, name: String?) async {
        guard status != .loading else { return }
        status = .loading
        do {
            try await googleSignIn.execute(idToken: idToken, name: name)
            status = .idle
        } catch {
            status = .error(Self.googleMessage(for: error))
        }
    }

    /// Fallo del flujo de Google antes de llegar al backend. Cancelar no es un error.
    func handleGoogleFailure(_ error: Error) {
        let nsError = error as NSError
        if nsError.domain == kGIDSignInErrorDomain, nsError.code == GIDSignInError.canceled.rawValue {
            return
        }
        status = .error("No se pudo iniciar sesión con Google. Inténtalo de nuevo.")
    }

    private static func message(for error: Error) -> String {
        switch error {
        case APIError.unauthorized:
            return "Email o contraseña incorrectos."
        case APIError.validation:
            return "Revisa los datos introducidos."
        case APIError.rateLimited:
            return "Demasiados intentos. Espera un momento y vuelve a intentarlo."
        case APIError.offline:
            return "Sin conexión. Inténtalo cuando vuelvas a tener red."
        default:
            return "Algo ha ido mal. Inténtalo de nuevo."
        }
    }

    private static func appleMessage(for error: Error) -> String {
        switch error {
        case APIError.unauthorized, APIError.validation:
            return "No se pudo validar tu cuenta de Apple. Inténtalo de nuevo."
        default:
            return message(for: error)
        }
    }

    private static func googleMessage(for error: Error) -> String {
        switch error {
        case APIError.unauthorized, APIError.validation:
            return "No se pudo validar tu cuenta de Google. Inténtalo de nuevo."
        default:
            return message(for: error)
        }
    }
}
