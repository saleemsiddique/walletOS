import Foundation

/// Estado de la pantalla de "olvidé mi contraseña". El backend responde 204 exista o no el
/// email, así que el éxito muestra siempre el mensaje neutro (no revela existencia de cuentas).
@MainActor
final class ForgotPasswordViewModel: ObservableObject {
    enum Status: Equatable {
        case idle
        case loading
        case sent
        case error(String)
    }

    @Published var email = ""
    @Published private(set) var status: Status = .idle

    private let requestPasswordReset: RequestPasswordReset

    init(requestPasswordReset: RequestPasswordReset) {
        self.requestPasswordReset = requestPasswordReset
    }

    var isEmailValid: Bool {
        EmailFormat.isValid(email)
    }

    var canSubmit: Bool {
        status != .loading && isEmailValid
    }

    func submit() async {
        guard canSubmit else { return }
        status = .loading
        do {
            try await requestPasswordReset.execute(email: email)
            status = .sent
        } catch {
            status = .error(Self.message(for: error))
        }
    }

    private static func message(for error: Error) -> String {
        switch error {
        case APIError.offline:
            return "Sin conexión. Inténtalo cuando vuelvas a tener red."
        case APIError.rateLimited:
            return "Demasiados intentos. Espera un momento y vuelve a intentarlo."
        default:
            return "Algo ha ido mal. Inténtalo de nuevo."
        }
    }
}
