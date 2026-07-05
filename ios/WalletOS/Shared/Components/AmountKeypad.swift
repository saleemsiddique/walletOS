import SwiftUI

/// Numpad del modal de transacción (design-system "Ledger": números en SF Mono, monocromo, filas
/// que respiran). Edita un importe en céntimos internamente para no arrastrar error de coma
/// flotante; el binding expone el `Decimal` en euros.
struct AmountKeypad: View {
    @Binding var amount: Decimal

    private let keys: [[String]] = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        [",", "0", "⌫"],
    ]

    var body: some View {
        VStack(spacing: Spacing.sm) {
            ForEach(keys, id: \.self) { row in
                HStack(spacing: Spacing.sm) {
                    ForEach(row, id: \.self) { key in
                        keyButton(key)
                    }
                }
            }
        }
    }

    private func keyButton(_ key: String) -> some View {
        Button {
            press(key)
            Haptics.light()
        } label: {
            Group {
                if key == "⌫" {
                    Image(systemName: "delete.left")
                        .font(.system(size: 20, weight: .light))
                } else {
                    Text(key)
                        .font(.system(.title2, design: .monospaced))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .foregroundStyle(AppColor.ink)
        }
        .accessibilityLabel(key == "⌫" ? "Borrar" : key)
    }

    /// Trabaja sobre céntimos: cada dígito desplaza el número una posición; la coma no hace nada
    /// (el formato con dos decimales es implícito) y el borrado divide entre 10.
    private func press(_ key: String) {
        var cents = NSDecimalNumber(decimal: amount * 100).intValue
        switch key {
        case "⌫":
            cents /= 10
        case ",":
            break
        default:
            guard let digit = Int(key) else { return }
            cents = cents * 10 + digit
        }
        amount = Decimal(cents) / 100
    }
}

#Preview {
    AmountKeypadPreview()
        .padding(Spacing.screenMargin)
        .background(AppColor.bg)
}

private struct AmountKeypadPreview: View {
    @State private var amount: Decimal = 0
    var body: some View {
        VStack {
            Text(CurrencyFormatter.eur(amount)).font(Typography.hero)
            AmountKeypad(amount: $amount)
        }
    }
}
