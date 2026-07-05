import SwiftUI

/// Botón único de Patrimonio para añadir una transacción (regla §7.1: una sola acción visible).
/// Estilo outline (no relleno) — el mockup aprobado lo distingue del `PrimaryButton` de los flujos
/// de una sola pantalla (Auth/Setup): en Home convive con el resto de la pantalla, no la domina.
struct AddTransactionButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("＋ Añadir")
                .font(Typography.headline)
                .foregroundStyle(AppColor.ink)
                .frame(maxWidth: .infinity, minHeight: PrimaryButton.minHeight)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
                .strokeBorder(AppColor.hairline, lineWidth: 0.5)
        )
    }
}

#Preview {
    AddTransactionButton(action: {})
        .padding(Spacing.screenMargin)
        .background(AppColor.bg)
}
