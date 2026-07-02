import SwiftUI

extension View {
    /// Sombra cálida del design system (§6): tinta de marca a baja opacidad, blur amplio y offset
    /// pequeño. Nada de sombras duras. Usada por tarjetas, modales y botones elevados.
    func cardShadow() -> some View {
        shadow(color: AppColor.shadowTint.opacity(0.12), radius: 16, x: 0, y: 4)
    }
}
