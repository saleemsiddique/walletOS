import SwiftUI

/// Selector de color para banco/wallet: paleta rápida de presets + picker nativo del sistema para
/// cualquier otro color (el backend guarda el hex resultante). Nombre propio para no chocar con
/// `SwiftUI.ColorPicker`, que usa como último control de la grid.
struct AccountColorPicker: View {
    @Binding var selectedHex: String

    /// Color por defecto del backend para banco y wallet (`#007AFF`).
    static let defaultHex = "#007AFF"

    /// Paleta rápida: acentos base del sistema + los colores de marca del catálogo de bancos
    /// (`BankCatalog`) — son datos públicos (el color asociado a una marca), no el logo en sí.
    /// Sin duplicados si algún color de banco coincide con uno base.
    static let palette: [String] = {
        let base = ["#007AFF", "#30D158", "#FF9F0A", "#FF453A", "#BF5AF2", "#64D2FF", "#FFD60A", "#8E8E93"]
        var seen = Set(base.map { $0.uppercased() })
        let bankColors = BankCatalog.entries.map(\.brandColorHex).filter { seen.insert($0.uppercased()).inserted }
        return base + bankColors
    }()

    private let columns = [GridItem(.adaptive(minimum: 44), spacing: Spacing.sm)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: Spacing.sm) {
            ForEach(Self.palette, id: \.self) { hex in
                swatch(hex)
            }
            customColorPicker
        }
    }

    private func swatch(_ hex: String) -> some View {
        Button {
            selectedHex = hex
            Haptics.light()
        } label: {
            Circle()
                .fill(Color(hex: hex))
                .frame(width: 30, height: 30)
                .overlay(
                    Circle().strokeBorder(
                        AppColor.textPrimary,
                        lineWidth: hex == selectedHex ? 2 : 0
                    )
                )
                .frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel(hex)
        .accessibilityAddTraits(hex == selectedHex ? [.isSelected] : [])
    }

    /// Última opción de la grid: el picker nativo de iOS (RGB, HSB, hex, cuentagotas) para
    /// cualquier color que no esté en la paleta rápida.
    private var customColorPicker: some View {
        ColorPicker("Otro color", selection: customColorBinding, supportsOpacity: false)
            .labelsHidden()
            .frame(minWidth: 44, minHeight: 44)
    }

    private var customColorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: selectedHex) },
            set: { selectedHex = $0.hexString }
        )
    }
}

#Preview {
    AccountColorPickerPreview()
        .padding(Spacing.screenMargin)
        .background(AppColor.bg)
}

private struct AccountColorPickerPreview: View {
    @State private var hex = AccountColorPicker.defaultHex
    var body: some View { AccountColorPicker(selectedHex: $hex) }
}
