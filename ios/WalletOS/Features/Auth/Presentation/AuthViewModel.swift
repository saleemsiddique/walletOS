import Foundation

/// Estado y acciones de la pantalla de auth: alterna Login/Registro, valida email/contraseña
/// y ejecuta el caso de uso correspondiente. El éxito no navega desde aquí: la sesión queda
/// guardada y la vista raíz reacciona al `AuthState` (gancho Setup vs Home, Rama 14).
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

    init(loginUser: LoginUser, registerUser: RegisterUser) {
        self.loginUser = loginUser
        self.registerUser = registerUser
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
}
