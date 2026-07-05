import AuthenticationServices
import GoogleSignIn
import SwiftUI

/// Pantalla de autenticación (pantalla 01), estilo "Ledger": título a la izquierda, formulario
/// sobre hairlines, una acción primaria y accesos con Apple (nativo) y Google (SDK oficial).
struct AuthView: View {
    @ObservedObject var viewModel: AuthViewModel
    /// Gancho de navegación a la pantalla de forgot password (Rama 12).
    var onForgotPassword: () -> Void = {}

    @Environment(\.colorScheme) private var colorScheme

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
        VStack(spacing: Spacing.sm) {
            appleButton
            SocialSignInButton(symbolName: "g.circle", title: "Continuar con Google") {
                startGoogleSignIn()
            }
            .disabled(viewModel.status == .loading)
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            handleAppleAuthorization(result)
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        // El botón nativo solo lee su estilo al crearse: recrearlo cuando cambia el tema.
        .id(colorScheme)
        .frame(height: 52)
        .clipShape(RoundedRectangle(cornerRadius: Radius.container, style: .continuous))
        .disabled(viewModel.status == .loading)
    }

    private func startGoogleSignIn() {
        guard let presenter = Self.rootViewController else { return }
        Task {
            do {
                let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
                guard let idToken = result.user.idToken?.tokenString else {
                    viewModel.handleGoogleFailure(GoogleCredentialError.missingIDToken)
                    return
                }
                await viewModel.signInWithGoogle(idToken: idToken, name: result.user.profile?.name)
            } catch {
                viewModel.handleGoogleFailure(error)
            }
        }
    }

    /// El SDK de Google necesita un `UIViewController` desde el que presentar su sheet.
    private static var rootViewController: UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
    }

    private func handleAppleAuthorization(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let identityToken = String(data: tokenData, encoding: .utf8)
            else {
                viewModel.handleAppleFailure(AppleCredentialError.missingIdentityToken)
                return
            }
            let name = credential.fullName.flatMap { components in
                let formatted = PersonNameComponentsFormatter().string(from: components)
                return formatted.isEmpty ? nil : formatted
            }
            Task { await viewModel.signInWithApple(identityToken: identityToken, name: name) }
        case .failure(let error):
            viewModel.handleAppleFailure(error)
        }
    }
}

/// La autorización llegó sin `identity_token` legible (no debería ocurrir con una credencial real).
private enum AppleCredentialError: Error {
    case missingIdentityToken
}

/// El SDK de Google devolvió un usuario sin `id_token` (no debería ocurrir tras un login correcto).
private enum GoogleCredentialError: Error {
    case missingIDToken
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
    AuthView(viewModel: makePreviewViewModel())
}

#Preview("Oscuro") {
    AuthView(viewModel: makePreviewViewModel())
        .preferredColorScheme(.dark)
}

@MainActor
private func makePreviewViewModel() -> AuthViewModel {
    let repository = PreviewAuthRepository()
    return AuthViewModel(
        loginUser: LoginUser(repository: repository),
        registerUser: RegisterUser(repository: repository),
        appleSignIn: SignInWithApple(repository: repository),
        googleSignIn: SignInWithGoogle(repository: repository)
    )
}

private struct PreviewAuthRepository: AuthRepository {
    func register(email: String, password: String, name: String) async throws {}
    func login(email: String, password: String) async throws {}
    func signInWithApple(identityToken: String, name: String?) async throws {}
    func signInWithGoogle(idToken: String, name: String?) async throws {}
    func requestPasswordReset(email: String) async throws {}
    func resetPassword(token: String, newPassword: String) async throws {}
    func refresh() async throws {}
    func logout() async {}
}
