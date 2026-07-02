import UIKit

/// Retroalimentación háptica del design system (§10). Sin haptics en scroll ni acciones pasivas.
enum Haptics {
    /// Guardar ingreso, cumplir meta.
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    /// Alerta de gasto alto.
    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    /// Toques de acción, swipe, cambio de segmento.
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
