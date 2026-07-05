import Foundation

/// Estado de la pantalla de restablecer contraseña: recibe el token del deep link, valida la
/// contraseña nueva con confirmación y ejecuta el reset. Un token inválido o caducado se marca
/// aparte para que la vista ofrezca pedir un enlace nuevo.
@MainActor
final class ResetPasswordViewModel: ObservableObject {
    enum Status: Equatable {
        case idle
        case loading
        case success
        case error(String)
    }

    @Published var newPassword = ""
    @Published var confirmation = ""
    @Published private(set) var status: Status = .idle
    /// El backend rechazó el token (inválido, caducado o ya usado): ofrecer pedir otro enlace.
    @Published private(set) var isTokenInvalid = false

    private let token: String
    private let resetPassword: ResetPassword

    init(token: String, resetPassword: ResetPassword) {
        self.token = token
        self.resetPassword = resetPassword
    }

    /// Mínimo del backend: 8 caracteres.
    var isPasswordValid: Bool {
        newPassword.count >= 8
    }

    var passwordsMatch: Bool {
        newPassword == confirmation
    }

    var canSubmit: Bool {
        status != .loading && isPasswordValid && passwordsMatch
    }

    func submit() async {
        guard canSubmit else { return }
        status = .loading
        isTokenInvalid = false
        do {
            try await resetPassword.execute(token: token, newPassword: newPassword)
            status = .success
        } catch {
            switch error {
            case APIError.unauthorized, APIError.validation, APIError.notFound:
                isTokenInvalid = true
                status = .error("El enlace no es válido o ha caducado. Solicita uno nuevo.")
            case APIError.offline:
                status = .error("Sin conexión. Inténtalo cuando vuelvas a tener red.")
            case APIError.rateLimited:
                status = .error("Demasiados intentos. Espera un momento y vuelve a intentarlo.")
            default:
                status = .error("Algo ha ido mal. Inténtalo de nuevo.")
            }
        }
    }
}
