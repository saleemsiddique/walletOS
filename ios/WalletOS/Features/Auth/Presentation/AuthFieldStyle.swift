import SwiftUI

/// Campo de formulario "Ledger" del flujo de auth: relleno `surface`, radio único y borde
/// hairline. Lo comparten Auth, Forgot y Reset.
struct AuthFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Typography.body)
            .padding(Spacing.md)
            .background(
                AppColor.surface,
                in: RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
                    .strokeBorder(AppColor.separator, lineWidth: 0.5)
            }
    }
}
