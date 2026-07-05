import SwiftUI

/// Grid de categorías (4 columnas) del modal de transacción. Resuelve el `icon` (emoji) de cada
/// categoría a SF Symbol con `IconCatalog` — nunca pinta el emoji (design-system §5).
struct CategoryGrid: View {
    let categories: [TransactionCategory]
    @Binding var selectedId: String?

    private let columns = Array(
        repeating: GridItem(.flexible(), spacing: Spacing.sm),
        count: 4
    )

    var body: some View {
        LazyVGrid(columns: columns, spacing: Spacing.md) {
            ForEach(categories) { category in
                Button {
                    selectedId = category.id
                    Haptics.light()
                } label: {
                    cell(for: category)
                }
                .accessibilityLabel(category.name)
                .accessibilityAddTraits(isSelected(category) ? [.isSelected] : [])
            }
        }
    }

    private func cell(for category: TransactionCategory) -> some View {
        VStack(spacing: Spacing.xxs) {
            Image(systemName: IconCatalog.symbol(forEmoji: category.icon, fallback: .category))
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(isSelected(category) ? AppColor.onAccent : AppColor.inkSoft)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
                        .fill(isSelected(category) ? AppColor.accent : Color.clear)
                )
            Text(category.name)
                .font(Typography.caption)
                .foregroundStyle(AppColor.inkSoft)
                .lineLimit(1)
        }
    }

    private func isSelected(_ category: TransactionCategory) -> Bool {
        category.id == selectedId
    }
}
