import SwiftUI

/// Botón primario del design system (§8): píldora de ancho completo, altura mínima de toque
/// one-hand y tokens de tema. Primer componente base del registro de `screens/README.md`.
struct PrimaryButton: View {
    /// Altura mínima de toque (§6): 56–64 pt. Se expone para verificarlo y reutilizarlo.
    static let minHeight: CGFloat = 56

    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Typography.headline)
                .frame(maxWidth: .infinity, minHeight: Self.minHeight)
        }
        .buttonStyle(PrimaryButtonStyle())
    }
}

private struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(AppColor.textOnBrand)
            .background(
                AppColor.accent,
                in: RoundedRectangle(cornerRadius: Radius.pill, style: .continuous)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(Motion.lively, value: configuration.isPressed)
            .cardShadow()
    }
}

#Preview {
    VStack(spacing: Spacing.md) {
        PrimaryButton(title: "Continuar", action: {})
        PrimaryButton(title: "Crear cuenta", action: {})
    }
    .padding(Spacing.screenMargin)
    .background(AppColor.bg)
}
