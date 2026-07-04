import SwiftUI

/// Toggle de opciones estilo pill con thumb deslizante (01-auth.md). Sustituye al segmented
/// control del sistema para mantener la redondez y las sombras cálidas de la marca.
struct SegmentedPillToggle<Option: Hashable>: View {
    @Binding var selection: Option
    let options: [(value: Option, label: String)]

    @Namespace private var thumbNamespace
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionEnabled

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.value) { option in
                segmentButton(for: option)
            }
        }
        .padding(Spacing.xxs)
        .background(AppColor.surfaceAlt, in: Capsule(style: .continuous))
    }

    private func segmentButton(for option: (value: Option, label: String)) -> some View {
        Button {
            guard option.value != selection else { return }
            Haptics.light()
            withAnimation(isReduceMotionEnabled ? nil : Motion.lively) {
                selection = option.value
            }
        } label: {
            Text(option.label)
                .font(Typography.body.weight(option.value == selection ? .semibold : .regular))
                .foregroundStyle(AppColor.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .background {
            if option.value == selection {
                Capsule(style: .continuous)
                    .fill(AppColor.surface)
                    .matchedGeometryEffect(id: "thumb", in: thumbNamespace)
                    .cardShadow()
            }
        }
        .accessibilityAddTraits(option.value == selection ? .isSelected : [])
    }
}

#Preview {
    struct PreviewHost: View {
        @State private var selection = "login"

        var body: some View {
            SegmentedPillToggle(
                selection: $selection,
                options: [("login", "Entrar"), ("register", "Crear cuenta")]
            )
            .padding(Spacing.screenMargin)
            .background(AppColor.bg)
        }
    }
    return PreviewHost()
}
