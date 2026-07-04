import SwiftUI

/// Vista raíz: observa el `AuthState` y decide entre el flujo de auth y la app autenticada.
/// La pantalla autenticada es un placeholder hasta la decisión Setup vs Home (Rama 14).
struct RootView: View {
    @ObservedObject private var authState: AuthState
    @StateObject private var authViewModel: AuthViewModel

    init(dependencies: AppDependencies) {
        authState = dependencies.authState
        _authViewModel = StateObject(wrappedValue: dependencies.makeAuthViewModel())
    }

    var body: some View {
        switch authState.status {
        case .signedOut:
            AuthView(viewModel: authViewModel)
        case .signedIn:
            RootPlaceholderView()
        }
    }
}
