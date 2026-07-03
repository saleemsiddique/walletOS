import SwiftUI

/// Compone el personaje sobre su hábitat mostaza (design-system.md §3), en un slot de tamaño fijo.
/// Es lo que colocan las pantallas (Home, Setup, Insights, estados vacíos).
struct MascotPanel: View {
    let state: MascotState
    var gesture: MascotGesture = .idle
    var slot: MascotSlot = .hero

    var body: some View {
        MascotView(state: state, gesture: gesture)
            .frame(width: slot.size, height: slot.size)
            .background(AppColor.mascotStage)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
    }
}

#Preview {
    VStack(spacing: Spacing.lg) {
        HStack(spacing: Spacing.lg) {
            MascotPanel(state: .empty, slot: .panel)
            MascotPanel(state: .serene, slot: .panel)
        }
        HStack(spacing: Spacing.lg) {
            MascotPanel(state: .happy, slot: .panel)
            MascotPanel(state: .overflow, slot: .panel)
        }
    }
    .padding(Spacing.screenMargin)
    .background(AppColor.bg)
}
