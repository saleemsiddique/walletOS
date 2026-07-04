/// Rutas del flujo no autenticado (push sobre el `NavigationStack` de la raíz).
enum AuthRoute: Hashable {
    case forgotPassword
    case resetPassword(token: String)
}
