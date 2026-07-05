import SwiftUI

/// Selector de icono: grid de SF Symbols del `IconCatalog` (design-system §5 — la UI nunca muestra
/// emoji). El llamador traduce el símbolo elegido al emoji que espera el backend con
/// `IconCatalog.emoji(forSymbol:)`.
struct IconPicker: View {
    @Binding var selectedSymbol: String

    private let symbols = IconCatalog.pickerSymbols
    private let columns = Array(
        repeating: GridItem(.flexible(), spacing: Spacing.sm),
        count: 5
    )

    var body: some View {
        LazyVGrid(columns: columns, spacing: Spacing.sm) {
            ForEach(symbols, id: \.self) { symbol in
                Button {
                    selectedSymbol = symbol
                    Haptics.light()
                } label: {
                    Image(systemName: symbol)
                        .font(.system(size: 20, weight: .light))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(isSelected(symbol) ? AppColor.textOnBrand : AppColor.textSecondary)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.container, style: .continuous)
                                .fill(isSelected(symbol) ? AppColor.accent : Color.clear)
                        )
                }
                .accessibilityLabel(symbol)
                .accessibilityAddTraits(isSelected(symbol) ? [.isSelected] : [])
            }
        }
    }

    private func isSelected(_ symbol: String) -> Bool {
        symbol == selectedSymbol
    }
}

#Preview {
    IconPickerPreview()
        .padding(Spacing.screenMargin)
        .background(AppColor.bg)
}

private struct IconPickerPreview: View {
    @State private var symbol = IconCatalog.pickerSymbols.first ?? "building.columns.fill"
    var body: some View { IconPicker(selectedSymbol: $symbol) }
}
