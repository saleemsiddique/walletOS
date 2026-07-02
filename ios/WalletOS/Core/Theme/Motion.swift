import SwiftUI

/// Duraciones y curvas de movimiento del design system (§9). Respetar Reduce Motion es
/// responsabilidad de cada vista (frames estáticos en lugar de springs).
enum Motion {
    static let fast: TimeInterval = 0.15
    static let base: TimeInterval = 0.25
    static let slow: TimeInterval = 0.40

    /// Crossfade entre clips al cambiar el estado de la mascota.
    static let mascotCrossfade: TimeInterval = 0.30

    /// Spring suave para elementos "vivos": botones, mascota, aparición de tarjetas.
    static var lively: Animation { .spring(response: 0.35, dampingFraction: 0.72) }

    /// Ease-in-out para transiciones de pantalla.
    static var screenTransition: Animation { .easeInOut(duration: base) }
}
