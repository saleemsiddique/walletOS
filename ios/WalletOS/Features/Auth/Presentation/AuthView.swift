import SwiftUI

/// Pantalla de autenticación (pantalla 01): toggle Login/Registro, formulario email+contraseña
/// y accesos con Apple/Google (placeholders hasta las Ramas 10–11). UI provisional a la espera
/// de la nueva dirección estética (ver `docs/design-system.md`).
struct AuthView: View {
    @ObservedObject var viewModel: AuthViewModel
    /// Gancho de navegación a la pantalla de forgot password (Rama 12).
    var onForgotPassword: () -> Void = {}

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.xl) {
                header
                modePicker
                credentialFields
                if case .error(let message) = viewModel.status {
                    errorLabel(message)
                }
                submitButton
                socialButtons
                if viewModel.mode == .login {
                    forgotPasswordLink
                }
            }
            .padding(Spacing.screenMargin)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AppColor.bg)
    }

    private var header: some View {
        Text("WalletOS")
            .font(Typography.title)
            .foregroundStyle(AppColor.textPrimary)
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
                Text("Mínimo 8 caracteres.")
                    .font(Typography.caption)
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
            .opacity(viewModel.canSubmit ? 1 : 0.5)
            if viewModel.status == .loading {
                ProgressView()
                    .tint(AppColor.textOnBrand)
            }
        }
    }

    private var socialButtons: some View {
        VStack(spacing: Spacing.sm) {
            SocialSignInButton(symbolName: "apple.logo", title: "Continuar con Apple")
            SocialSignInButton(symbolName: "g.circle", title: "Continuar con Google")
        }
    }

    private var forgotPasswordLink: some View {
        Button("¿Olvidaste tu contraseña?", action: onForgotPassword)
            .font(Typography.body)
            .foregroundStyle(AppColor.textSecondary)
    }
}

/// Campo de formulario sobre `surface` con el radio medio del design system.
private struct AuthFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Typography.body)
            .padding(Spacing.md)
            .background(AppColor.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
    }
}

/// Botón de acceso social. Placeholder deshabilitado hasta que las Ramas 10–11 le den acción.
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
                .frame(maxWidth: .infinity, minHeight: PrimaryButton.minHeight)
        }
        .foregroundStyle(AppColor.textPrimary)
        .background(AppColor.surfaceAlt, in: RoundedRectangle(cornerRadius: Radius.pill, style: .continuous))
        .disabled(action == nil)
        .opacity(action == nil ? 0.5 : 1)
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

private struct PreviewAuthRepository: AuthRepository {
    func register(email: String, password: String, name: String) async throws {}
    func login(email: String, password: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}
