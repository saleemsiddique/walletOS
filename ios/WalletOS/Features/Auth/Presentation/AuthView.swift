import SwiftUI

/// Pantalla de autenticación según `docs/screens/01-auth.md`: hábitat mostaza a sangre con la
/// mascota integrada (reactiva al modo), toggle pill Login/Registro, campos con icono y accesos
/// sociales como placeholders (Ramas 10–11).
struct AuthView: View {
    @ObservedObject var viewModel: AuthViewModel
    /// Gancho de navegación a la pantalla de forgot password (Rama 12).
    var onForgotPassword: () -> Void = {}

    @FocusState private var focusedField: Field?
    @State private var isKeyboardVisible = false
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionEnabled

    private enum Field {
        case name
        case email
        case password
    }

    var body: some View {
        VStack(spacing: 0) {
            MascotStage(
                state: viewModel.mode == .register ? .happy : .serene,
                gesture: mascotGesture,
                title: "WalletOS",
                subtitle: greeting,
                isCollapsed: isKeyboardVisible
            )
            ScrollView {
                formContent
                    .padding(Spacing.screenMargin)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(AppColor.bg)
        .animation(isReduceMotionEnabled ? nil : Motion.lively, value: isKeyboardVisible)
        .animation(isReduceMotionEnabled ? nil : Motion.lively, value: viewModel.mode)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            isKeyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            isKeyboardVisible = false
        }
        .onChange(of: viewModel.status) { status in
            if case .error = status {
                Haptics.warning()
            }
        }
    }

    // MARK: - Hábitat

    private var greeting: String? {
        guard !isKeyboardVisible else { return nil }
        return viewModel.mode == .register ? "¡Una cartera nueva!" : "Hola, soy tu cartera."
    }

    private var mascotGesture: MascotGesture {
        if viewModel.status == .loading { return .thinking }
        if viewModel.hasConnectionError { return .shrug }
        return viewModel.mode == .login ? .wave : .idle
    }

    // MARK: - Formulario

    private var formContent: some View {
        VStack(spacing: Spacing.lg) {
            SegmentedPillToggle(
                selection: $viewModel.mode,
                options: [(.login, "Entrar"), (.register, "Crear cuenta")]
            )
            credentialFields
            if case .error(let message) = viewModel.status {
                errorLabel(message)
            }
            VStack(spacing: Spacing.sm) {
                if viewModel.mode == .login {
                    forgotPasswordLink
                }
                submitButton
                if viewModel.isOffline {
                    offlineNotice
                }
            }
            divider
            socialButtons
        }
    }

    private var credentialFields: some View {
        VStack(spacing: Spacing.sm) {
            if viewModel.mode == .register {
                IconTextField(
                    symbolName: "person", placeholder: "Nombre", text: $viewModel.name,
                    focus: $focusedField, focusValue: .name
                )
                .textContentType(.name)
                .submitLabel(.next)
                .onSubmit { focusedField = .email }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            IconTextField(
                symbolName: "envelope", placeholder: "Email", text: $viewModel.email,
                focus: $focusedField, focusValue: .email
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.next)
            .onSubmit { focusedField = .password }
            IconTextField(
                symbolName: "lock", placeholder: "Contraseña", text: $viewModel.password, isSecure: true,
                focus: $focusedField, focusValue: .password
            )
            .textContentType(viewModel.mode == .register ? .newPassword : .password)
            .submitLabel(.go)
            .onSubmit {
                focusedField = nil
                Task { await viewModel.submit() }
            }
            if viewModel.mode == .register {
                Text("Mínimo 8 caracteres.")
                    .font(Typography.caption)
                    .foregroundStyle(AppColor.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity)
            }
        }
        .disabled(viewModel.status == .loading)
        .modifier(ShakeEffect(shakes: CGFloat(viewModel.failedAttempts)))
        .animation(
            isReduceMotionEnabled ? nil : .linear(duration: Motion.slow),
            value: viewModel.failedAttempts
        )
    }

    private func errorLabel(_ message: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Text(message)
                .font(Typography.body)
                .foregroundStyle(AppColor.expense)
            if viewModel.isEmailTakenError {
                Button("Entrar") {
                    viewModel.mode = .login
                }
                .font(Typography.body.weight(.semibold))
                .foregroundStyle(AppColor.accent)
            }
            Spacer(minLength: 0)
        }
    }

    private var forgotPasswordLink: some View {
        Button("¿Olvidaste tu contraseña?", action: onForgotPassword)
            .font(Typography.caption)
            .foregroundStyle(AppColor.textSecondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var submitButton: some View {
        ZStack {
            PrimaryButton(title: viewModel.mode == .login ? "Entrar" : "Crear cuenta") {
                focusedField = nil
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

    private var offlineNotice: some View {
        Text("Sin conexión.")
            .font(Typography.caption)
            .foregroundStyle(AppColor.textSecondary)
    }

    private var divider: some View {
        HStack(spacing: Spacing.sm) {
            separatorLine
            Text("o")
                .font(Typography.caption)
                .foregroundStyle(AppColor.textSecondary)
            separatorLine
        }
    }

    private var separatorLine: some View {
        Rectangle()
            .fill(AppColor.separator)
            .frame(height: 1)
    }

    private var socialButtons: some View {
        HStack(spacing: Spacing.sm) {
            SocialSignInButton(symbolName: "apple.logo", title: "Apple")
            SocialSignInButton(symbolName: "g.circle", title: "Google")
        }
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
