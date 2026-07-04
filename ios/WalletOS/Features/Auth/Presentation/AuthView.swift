import SwiftUI

/// Pantalla de autenticación (pantalla 01), estilo "Ledger": título a la izquierda, formulario
/// sobre hairlines, una acción primaria y accesos Apple/Google como placeholders (Ramas 10–11).
struct AuthView: View {
    @ObservedObject var viewModel: AuthViewModel
    /// Gancho de navegación a la pantalla de forgot password (Rama 12).
    var onForgotPassword: () -> Void = {}

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                header
                modePicker
                credentialFields
                if case .error(let message) = viewModel.status {
                    errorLabel(message)
                }
                VStack(spacing: Spacing.md) {
                    submitButton
                    if viewModel.mode == .login {
                        forgotPasswordLink
                    }
                }
                divider
                socialButtons
            }
            .padding(Spacing.screenMargin)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AppColor.bg)
        .tint(AppColor.accent)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text("WalletOS")
                .font(Typography.title)
                .foregroundStyle(AppColor.textPrimary)
            Text("TU PATRIMONIO, EN ORDEN")
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.textSecondary)
        }
        .padding(.top, Spacing.xxl)
    }

    private var modePicker: some View {
        Picker("Modo", selection: $viewModel.mode) {
            Text("Entrar").tag(AuthViewModel.Mode.login)
            Text("Crear cuenta").tag(AuthViewModel.Mode.register)
        }
        .pickerStyle(.segmented)
    }

    private var credentialFields: some View {
        VStack(spacing: Spacing.sm) {
            if viewModel.mode == .register {
                TextField("Nombre", text: $viewModel.name)
                    .textContentType(.name)
                    .modifier(AuthFieldStyle())
            }
            TextField("Email", text: $viewModel.email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .modifier(AuthFieldStyle())
            SecureField("Contraseña", text: $viewModel.password)
                .textContentType(viewModel.mode == .register ? .newPassword : .password)
                .modifier(AuthFieldStyle())
            if viewModel.mode == .register {
                Text("MÍNIMO 8 CARACTERES")
                    .font(Typography.caption)
                    .kerning(0.8)
                    .foregroundStyle(AppColor.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func errorLabel(_ message: String) -> some View {
        Text(message)
            .font(Typography.body)
            .foregroundStyle(AppColor.expense)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var submitButton: some View {
        ZStack {
            PrimaryButton(title: viewModel.mode == .login ? "Entrar" : "Crear cuenta") {
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

    private var forgotPasswordLink: some View {
        Button("¿Olvidaste tu contraseña?", action: onForgotPassword)
            .font(Typography.caption)
            .foregroundStyle(AppColor.accent)
            .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var divider: some View {
        HStack(spacing: Spacing.sm) {
            hairline
            Text("O")
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.textSecondary)
            hairline
        }
    }

    private var hairline: some View {
        Rectangle()
            .fill(AppColor.separator)
            .frame(height: 0.5)
    }

    private var socialButtons: some View {
        HStack(spacing: Spacing.sm) {
            SocialSignInButton(symbolName: "apple.logo", title: "Apple")
            SocialSignInButton(symbolName: "g.circle", title: "Google")
        }
    }
}

/// Campo de formulario "Ledger": relleno `surface`, radio único y borde hairline.
private struct AuthFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Typography.body)
            .padding(Spacing.md)
            .background(
                AppColor.surface,
                in: RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
                    .strokeBorder(AppColor.separator, lineWidth: 0.5)
            }
    }
}

/// Acceso social como pill silenciosa: solo borde hairline y tinta. Placeholder deshabilitado
/// hasta que las Ramas 10–11 le den acción.
private struct SocialSignInButton: View {
    let symbolName: String
    let title: String
    var action: (() -> Void)?

    var body: some View {
        Button {
            action?()
        } label: {
            Label(title, systemImage: symbolName)
                .font(Typography.body)
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .foregroundStyle(AppColor.textPrimary)
        .background {
            RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
                .strokeBorder(AppColor.separator, lineWidth: 0.5)
        }
        .disabled(action == nil)
        .opacity(action == nil ? 0.4 : 1)
    }
}

#Preview {
    AuthView(
        viewModel: AuthViewModel(
            loginUser: LoginUser(repository: PreviewAuthRepository()),
            registerUser: RegisterUser(repository: PreviewAuthRepository())
        )
    )
}

#Preview("Oscuro") {
    AuthView(
        viewModel: AuthViewModel(
            loginUser: LoginUser(repository: PreviewAuthRepository()),
            registerUser: RegisterUser(repository: PreviewAuthRepository())
        )
    )
    .preferredColorScheme(.dark)
}

private struct PreviewAuthRepository: AuthRepository {
    func register(email: String, password: String, name: String) async throws {}
    func login(email: String, password: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}
