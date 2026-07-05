import SwiftUI

/// Pantalla de restablecer contraseña (pantalla 03), estilo "Ledger". Llega desde el deep link
/// `walletos://reset?token=...`. Al éxito comunica el cierre de todas las sesiones y devuelve
/// al login; con token inválido ofrece pedir un enlace nuevo.
struct ResetPasswordView: View {
    @StateObject private var viewModel: ResetPasswordViewModel
    /// Vuelta al login (pop de todo el stack) tras completar el reset.
    let onFinished: () -> Void
    /// El token no vale: ir a la pantalla de forgot para pedir otro enlace.
    let onRequestNewLink: () -> Void

    init(
        viewModel: @autoclosure @escaping () -> ResetPasswordViewModel,
        onFinished: @escaping () -> Void,
        onRequestNewLink: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: viewModel())
        self.onFinished = onFinished
        self.onRequestNewLink = onRequestNewLink
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                header
                if viewModel.status == .success {
                    successContent
                } else {
                    form
                }
            }
            .padding(Spacing.screenMargin)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AppColor.bg)
        .tint(AppColor.accent)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text("Nueva contraseña")
                .font(Typography.title)
                .foregroundStyle(AppColor.ink)
            Text("MÍNIMO 8 CARACTERES")
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.inkSoft)
        }
        .padding(.top, Spacing.md)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            VStack(spacing: Spacing.sm) {
                SecureField("Contraseña nueva", text: $viewModel.newPassword)
                    .textContentType(.newPassword)
                    .modifier(AuthFieldStyle())
                SecureField("Repite la contraseña", text: $viewModel.confirmation)
                    .textContentType(.newPassword)
                    .modifier(AuthFieldStyle())
                if !viewModel.confirmation.isEmpty, !viewModel.passwordsMatch {
                    Text("Las contraseñas no coinciden.")
                        .font(Typography.caption)
                        .foregroundStyle(AppColor.expense)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            if case .error(let message) = viewModel.status {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(message)
                        .font(Typography.body)
                        .foregroundStyle(AppColor.expense)
                    if viewModel.isTokenInvalid {
                        Button("Solicitar un enlace nuevo", action: onRequestNewLink)
                            .font(Typography.body.weight(.semibold))
                            .foregroundStyle(AppColor.accent)
                    }
                }
            }
            ZStack {
                PrimaryButton(title: "Guardar contraseña") {
                    Task { await viewModel.submit() }
                }
                .disabled(!viewModel.canSubmit)
                .opacity(viewModel.canSubmit ? 1 : 0.4)
                if viewModel.status == .loading {
                    ProgressView()
                        .tint(AppColor.onAccent)
                }
            }
        }
    }

    private var successContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Contraseña actualizada.")
                    .font(Typography.body)
                    .foregroundStyle(AppColor.ink)
                Text("POR SEGURIDAD SE CERRARON TODAS TUS SESIONES")
                    .font(Typography.caption)
                    .kerning(0.8)
                    .foregroundStyle(AppColor.inkSoft)
            }
            PrimaryButton(title: "Ir a Entrar", action: onFinished)
        }
    }
}

#Preview {
    NavigationStack {
        ResetPasswordView(
            viewModel: ResetPasswordViewModel(
                token: "token-preview",
                resetPassword: ResetPassword(repository: PreviewRepository())
            ),
            onFinished: {},
            onRequestNewLink: {}
        )
    }
}

private struct PreviewRepository: AuthRepository {
    func register(email: String, password: String, name: String) async throws {}
    func login(email: String, password: String) async throws {}
    func signInWithApple(identityToken: String, name: String?) async throws {}
    func signInWithGoogle(idToken: String, name: String?) async throws {}
    func requestPasswordReset(email: String) async throws {}
    func resetPassword(token: String, newPassword: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}
