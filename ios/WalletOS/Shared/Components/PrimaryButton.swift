import SwiftUI

/// Botón primario del design system "Ledger" (§7): la única acción visible de la pantalla.
/// Relleno `accent`, radio único de contenedor, sin sombra; altura mínima de toque one-hand.
struct PrimaryButton: View {
    /// Altura mínima de toque (§10): 56–64 pt. Se expone para verificarlo y reutilizarlo.
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
                in: RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
            )
            .opacity(configuration.isPressed ? 0.8 : 1)
            .animation(Motion.press, value: configuration.isPressed)
    }
}

#Preview {
    VStack(spacing: Spacing.md) {
        PrimaryButton(title: "Entrar", action: {})
        PrimaryButton(title: "Añadir", action: {})
    }
    .padding(Spacing.screenMargin)
    .background(AppColor.bg)
}
