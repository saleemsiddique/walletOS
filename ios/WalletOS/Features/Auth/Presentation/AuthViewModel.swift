import Foundation

/// Estado y acciones de la pantalla de auth (01-auth.md): alterna Login/Registro, valida
/// email/contraseña y ejecuta el caso de uso correspondiente. El éxito no navega desde aquí:
/// la sesión queda guardada y la vista raíz reacciona al `AuthState` (gancho Setup vs Home,
/// Rama 14).
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
        didSet {
            status = .idle
            isEmailTakenError = false
            hasConnectionError = false
        }
    }
    @Published var name = ""
    @Published var email = ""
    @Published var password = ""
    @Published private(set) var status: Status = .idle
    /// 409 en registro: la vista ofrece la acción inline "Entrar" conservando el email.
    @Published private(set) var isEmailTakenError = false
    /// Se incrementa con cada envío fallido; la vista lo usa para animar el shake del formulario.
    @Published private(set) var failedAttempts = 0
    /// Sin conectividad (proactivo, vía `NetworkMonitoring`): la vista deshabilita el envío.
    @Published private(set) var isOffline = false

    private let loginUser: LoginUser
    private let registerUser: RegisterUser
    private var connectivityTask: Task<Void, Never>?

    init(loginUser: LoginUser, registerUser: RegisterUser, networkMonitor: NetworkMonitoring? = nil) {
        self.loginUser = loginUser
        self.registerUser = registerUser
        if let networkMonitor {
            connectivityTask = Task { [weak self] in
                for await isConnected in networkMonitor.pathUpdates() {
                    self?.isOffline = !isConnected
                }
            }
        }
    }

    deinit {
        connectivityTask?.cancel()
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
        guard status != .loading, !isOffline else { return false }
        let hasValidCredentials = isEmailValid && isPasswordValid
        switch mode {
        case .login: return hasValidCredentials
        case .register: return hasValidCredentials && isNameValid
        }
    }

    func submit() async {
        guard canSubmit else { return }
        status = .loading
        isEmailTakenError = false
        do {
            switch mode {
            case .login:
                try await loginUser.execute(email: email, password: password)
            case .register:
                try await registerUser.execute(email: email, password: password, name: name)
            }
            status = .idle
        } catch {
            let presentation = errorPresentation(for: error)
            status = .error(presentation.message)
            isEmailTakenError = presentation.isEmailTaken
            hasConnectionError = presentation.isConnectionProblem
            failedAttempts += 1
        }
    }

    /// El error viene de la red o del servidor (no de credenciales): la mascota reacciona (M-10).
    @Published private(set) var hasConnectionError = false

    private struct ErrorPresentation {
        let message: String
        var isEmailTaken = false
        var isConnectionProblem = false
    }

    private func errorPresentation(for error: Error) -> ErrorPresentation {
        switch error {
        case APIError.unauthorized:
            return ErrorPresentation(message: "Email o contraseña incorrectos.")
        case APIError.conflict where mode == .register:
            return ErrorPresentation(message: "Ese email ya está registrado.", isEmailTaken: true)
        case APIError.conflict, APIError.validation:
            return ErrorPresentation(message: "Revisa los datos introducidos.")
        case APIError.rateLimited:
            return ErrorPresentation(message: "Demasiados intentos. Espera un momento.")
        case APIError.offline:
            return ErrorPresentation(message: "Sin conexión.", isConnectionProblem: true)
        default:
            return ErrorPresentation(message: "Algo ha ido mal. Inténtalo de nuevo.", isConnectionProblem: true)
        }
    }
}
