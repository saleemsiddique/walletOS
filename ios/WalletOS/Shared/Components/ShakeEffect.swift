import SwiftUI

/// Sacudida horizontal para señalar un error de formulario (01-auth.md §microinteracciones).
/// Se anima incrementando `shakes` en 1 por cada error; desactivar con Reduce Motion.
struct ShakeEffect: GeometryEffect {
    var shakes: CGFloat

    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 8 * sin(shakes * 3 * 2 * .pi), y: 0))
    }
}
