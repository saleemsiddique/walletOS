import SwiftUI

/// Pantalla "olvidé mi contraseña" (pantalla 02), estilo "Ledger": un campo, una acción y el
/// mensaje neutro tras enviar (el backend nunca revela si el email existe).
struct ForgotPasswordView: View {
    @StateObject private var viewModel: ForgotPasswordViewModel

    init(viewModel: @autoclosure @escaping () -> ForgotPasswordViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                header
                if viewModel.status == .sent {
                    sentMessage
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
            Text("Recuperar contraseña")
                .font(Typography.title)
                .foregroundStyle(AppColor.textPrimary)
            Text("TE ENVIAMOS UN ENLACE POR EMAIL")
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.textSecondary)
        }
        .padding(.top, Spacing.md)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            TextField("Email", text: $viewModel.email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .modifier(AuthFieldStyle())
            if case .error(let message) = viewModel.status {
                Text(message)
                    .font(Typography.body)
                    .foregroundStyle(AppColor.expense)
            }
            ZStack {
                PrimaryButton(title: "Enviar enlace") {
                    Task { await viewModel.submit() }
                }
                .disabled(!viewModel.canSubmit)
                .opacity(viewModel.canSubmit ? 1 : 0.4)
                if viewModel.status == .loading {
                    ProgressView()
                        .tint(AppColor.textOnBrand)
                }
            }
        }
    }

    private var sentMessage: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Si el email existe, recibirás un enlace para restablecer la contraseña.")
                .font(Typography.body)
                .foregroundStyle(AppColor.textPrimary)
            Text("REVISA TU BANDEJA DE ENTRADA")
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.textSecondary)
        }
    }
}

#Preview {
    NavigationStack {
        ForgotPasswordView(
            viewModel: ForgotPasswordViewModel(
                requestPasswordReset: RequestPasswordReset(repository: PreviewRepository())
            )
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
