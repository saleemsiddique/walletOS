import SwiftUI

/// Placeholder de una tab aún no construida (regla §7.5 de `design-system.md`: estados de una
/// línea, sin ilustraciones). Se sustituye por la pantalla real en su propia rama.
struct ComingSoonView: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: symbol)
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(AppColor.inkSoft)
            Text(message)
                .font(Typography.body)
                .foregroundStyle(AppColor.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColor.bg)
        .navigationTitle(title)
    }
}

#Preview {
    NavigationStack {
        ComingSoonView(symbol: "chart.bar", title: "Actividad", message: "Próximamente.")
    }
}
