import SwiftUI

/// Pill outline compacta para accesos sociales (01-auth.md), dos por fila.
/// Sin `action` queda como placeholder deshabilitado (Apple/Google llegan en las Ramas 10–11).
struct SocialSignInButton: View {
    let symbolName: String
    let title: String
    var action: (() -> Void)?

    var body: some View {
        Button {
            action?()
        } label: {
            Label(title, systemImage: symbolName)
                .font(Typography.body.weight(.medium))
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .foregroundStyle(AppColor.textPrimary)
        .background {
            Capsule(style: .continuous)
                .strokeBorder(AppColor.separator, lineWidth: 1)
        }
        .disabled(action == nil)
        .opacity(action == nil ? 0.5 : 1)
    }
}

#Preview {
    HStack(spacing: Spacing.sm) {
        SocialSignInButton(symbolName: "apple.logo", title: "Apple")
        SocialSignInButton(symbolName: "g.circle", title: "Google")
    }
    .padding(Spacing.screenMargin)
    .background(AppColor.bg)
}
