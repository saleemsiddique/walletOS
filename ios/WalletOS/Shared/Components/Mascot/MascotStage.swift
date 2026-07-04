import SwiftUI

/// Banda mostaza a sangre completa (01-auth.md): el personaje vive integrado en su hábitat, sin
/// marco ni recorte — la banda usa `mascot-stage` (#F0B300, el fondo real de los PNG) y termina en
/// una curva inferior generosa sobre el fondo crema. `isCollapsed` la reduce a una franja compacta
/// (p. ej. mientras el teclado está abierto). La usan Auth y Setup.
struct MascotStage: View {
    let state: MascotState
    var gesture: MascotGesture = .idle
    let title: String
    var subtitle: String?
    var isCollapsed = false

    static let cornerRadius: CGFloat = 32
    static let expandedMascotSize: CGFloat = 180
    static let collapsedMascotSize: CGFloat = 64

    var body: some View {
        Group {
            if isCollapsed {
                collapsedContent
            } else {
                expandedContent
            }
        }
        .frame(maxWidth: .infinity)
        .foregroundStyle(AppColor.textOnBrand)
        .background {
            UnevenRoundedRectangle(
                bottomLeadingRadius: Self.cornerRadius,
                bottomTrailingRadius: Self.cornerRadius,
                style: .continuous
            )
            .fill(AppColor.mascotStage)
            .ignoresSafeArea(edges: .top)
        }
    }

    private var expandedContent: some View {
        VStack(spacing: Spacing.xs) {
            mascot(size: Self.expandedMascotSize)
            Text(title)
                .font(Typography.title)
            if let subtitle {
                Text(subtitle)
                    .font(Typography.body)
                    .opacity(0.75)
            }
        }
        .padding(.top, Spacing.xs)
        .padding(.bottom, Spacing.xl)
    }

    private var collapsedContent: some View {
        HStack(spacing: Spacing.sm) {
            mascot(size: Self.collapsedMascotSize)
            Text(title)
                .font(Typography.headline)
            Spacer()
        }
        .padding(.horizontal, Spacing.screenMargin)
        .padding(.vertical, Spacing.sm)
    }

    /// El fondo de los PNG/clips trae grano y no es un color perfectamente plano: un borde recto
    /// del asset se notaría sobre la banda. El feather (máscara con blur) funde los bordes.
    private func mascot(size: CGFloat) -> some View {
        MascotView(state: state, gesture: gesture)
            .frame(width: size, height: size)
            .mask {
                Rectangle()
                    .padding(size * 0.1)
                    .blur(radius: size * 0.1)
            }
    }
}

#Preview("Expandida") {
    VStack {
        MascotStage(state: .serene, title: "WalletOS", subtitle: "Hola, soy tu cartera.")
        Spacer()
    }
    .background(AppColor.bg)
}

#Preview("Colapsada") {
    VStack {
        MascotStage(state: .happy, title: "WalletOS", isCollapsed: true)
        Spacer()
    }
    .background(AppColor.bg)
}
