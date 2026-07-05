import Foundation

/// Estado de navegación de la tab bar raíz (Rama 15). Un `ObservableObject` en vez de `@State`
/// local para poder seleccionar una tab programáticamente desde fuera (p.ej. tras guardar una
/// transacción, saltar a Actividad) sin acoplar ese código a la vista de la tab bar.
@MainActor
final class AppRouter: ObservableObject {
    enum Tab {
        case patrimonio
        case actividad
        case insights
        case ajustes
    }

    @Published var selectedTab: Tab = .patrimonio
}
