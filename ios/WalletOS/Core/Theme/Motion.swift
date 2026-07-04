import SwiftUI

/// Movimiento del design system "Ledger" (§6): lo que dé el sistema y poco más. Duraciones
/// cortas, `easeInOut`, sin springs exagerados. Respetar Reduce Motion es responsabilidad
/// de cada vista.
enum Motion {
    static let fast: TimeInterval = 0.15
    static let base: TimeInterval = 0.25

    /// Feedback de pulsación (botones).
    static var press: Animation { .easeOut(duration: fast) }

    /// Transiciones dentro de una pantalla (aparición de secciones, cambios de estado).
    static var standard: Animation { .easeInOut(duration: base) }
}
