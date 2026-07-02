import Foundation

/// Fuente de la sesión que consume la capa de red. La implementación real (Keychain) llega en la
/// Rama 5; aquí se define la abstracción para que el `AuthInterceptor` no dependa del almacenamiento.
protocol TokenStoring: Sendable {
    var accessToken: String? { get async }
    var refreshToken: String? { get async }
    func saveTokens(access: String, refresh: String) async
    func clear() async
}
