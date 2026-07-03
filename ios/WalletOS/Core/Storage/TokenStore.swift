import Foundation

/// Fuente de verdad de la sesión: guarda y lee los tokens en el almacén seguro y mantiene
/// sincronizado el `AuthState`. Conforma `TokenStoring`, así que lo consume el `AuthInterceptor`.
actor TokenStore: TokenStoring {
    private let secureStore: SecureStoring
    private let authState: AuthState
    private let accessAccount = "access-token"
    private let refreshAccount = "refresh-token"

    init(secureStore: SecureStoring, authState: AuthState) {
        self.secureStore = secureStore
        self.authState = authState
    }

    var accessToken: String? {
        try? secureStore.value(for: accessAccount)
    }

    var refreshToken: String? {
        try? secureStore.value(for: refreshAccount)
    }

    func saveTokens(access: String, refresh: String) async {
        try? secureStore.set(access, for: accessAccount)
        try? secureStore.set(refresh, for: refreshAccount)
        await authState.update(to: .signedIn)
    }

    func clear() async {
        try? secureStore.removeValue(for: accessAccount)
        try? secureStore.removeValue(for: refreshAccount)
        await authState.update(to: .signedOut)
    }

    /// Al arrancar, pone el `AuthState` en `signedIn` si hay un refresh token persistido.
    func restoreSession() async {
        let refresh = try? secureStore.value(for: refreshAccount)
        await authState.update(to: refresh == nil ? .signedOut : .signedIn)
    }
}
