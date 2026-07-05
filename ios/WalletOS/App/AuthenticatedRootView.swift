import SwiftUI

/// Raíz de la app ya autenticada: resuelve setup vs Home según `GET /banks` y muestra el destino.
struct AuthenticatedRootView: View {
    @StateObject private var router: AuthenticatedRouterViewModel
    private let dependencies: AppDependencies

    init(dependencies: AppDependencies) {
        self.dependencies = dependencies
        _router = StateObject(wrappedValue: dependencies.makeAuthenticatedRouterViewModel())
    }

    var body: some View {
        Group {
            switch router.destination {
            case .loading:
                ProgressView()
            case .setup:
                SetupView(viewModel: dependencies.makeSetupViewModel(onFinished: router.goHome))
            case .home:
                RootTabView(dependencies: dependencies)
            case .failed:
                failedState
            }
        }
        .task { await router.decideDestination() }
    }

    private var failedState: some View {
        VStack(spacing: Spacing.md) {
            Text("No pudimos cargar tus datos.")
                .font(Typography.body)
                .foregroundStyle(AppColor.ink)
            Button("Reintentar") {
                Task { await router.decideDestination() }
            }
            .font(Typography.headline)
            .foregroundStyle(AppColor.accent)
        }
        .padding(Spacing.screenMargin)
    }
}
