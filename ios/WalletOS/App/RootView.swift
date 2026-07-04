import SwiftUI

/// Vista raíz: observa el `AuthState` y decide entre el flujo de auth (con su navegación a
/// forgot/reset) y la app autenticada. La pantalla autenticada es un placeholder hasta la
/// decisión Setup vs Home (Rama 14).
struct RootView: View {
    @ObservedObject private var authState: AuthState
    @StateObject private var authViewModel: AuthViewModel
    @Binding private var deepLink: DeepLink?
    @State private var authPath: [AuthRoute] = []
    private let dependencies: AppDependencies

    init(dependencies: AppDependencies, deepLink: Binding<DeepLink?>) {
        self.dependencies = dependencies
        authState = dependencies.authState
        _authViewModel = StateObject(wrappedValue: dependencies.makeAuthViewModel())
        _deepLink = deepLink
    }

    var body: some View {
        Group {
            switch authState.status {
            case .signedOut:
                NavigationStack(path: $authPath) {
                    AuthView(viewModel: authViewModel) {
                        authPath.append(.forgotPassword)
                    }
                    .navigationDestination(for: AuthRoute.self) { route in
                        destination(for: route)
                    }
                }
            case .signedIn:
                RootPlaceholderView()
            }
        }
        .onChange(of: deepLink) { link in
            guard case .resetPassword(let token) = link else { return }
            // El enlace de reset solo aplica sin sesión; con sesión se ignora (el propio flujo
            // de reset la invalidaría de todas formas).
            if authState.status == .signedOut {
                authPath = [.resetPassword(token: token)]
            }
            deepLink = nil
        }
    }

    @ViewBuilder
    private func destination(for route: AuthRoute) -> some View {
        switch route {
        case .forgotPassword:
            ForgotPasswordView(viewModel: dependencies.makeForgotPasswordViewModel())
        case .resetPassword(let token):
            ResetPasswordView(
                viewModel: dependencies.makeResetPasswordViewModel(token: token),
                onFinished: { authPath = [] },
                onRequestNewLink: { authPath = [.forgotPassword] }
            )
        }
    }
}
