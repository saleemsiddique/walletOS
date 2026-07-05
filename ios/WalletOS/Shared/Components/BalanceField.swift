import SwiftUI

/// Campo del balance inicial del wallet: la cifra protagonista del paso (design-system §3), en
/// SF Mono. Filtra la entrada carácter a carácter (solo dígitos y una coma decimal): el
/// `keyboardType(.decimalPad)` evita letras en el teclado en pantalla, pero no con teclado físico
/// (frecuente en el simulador con el teclado del Mac) — de ahí el filtro explícito.
struct BalanceField: View {
    @Binding var amount: Decimal
    @State private var text: String

    init(amount: Binding<Decimal>) {
        _amount = amount
        _text = State(initialValue: Self.text(from: amount.wrappedValue))
    }

    var body: some View {
        HStack(spacing: Spacing.xs) {
            TextField("0,00", text: $text)
                .keyboardType(.decimalPad)
                .onChange(of: text) { newValue in
                    let filtered = Self.filter(newValue)
                    if filtered != newValue {
                        text = filtered
                    }
                    amount = Self.decimal(from: filtered)
                }
            Text("€")
                .foregroundStyle(AppColor.textSecondary)
        }
        .font(Typography.hero)
        .foregroundStyle(AppColor.textPrimary)
    }

    /// Solo dígitos y, como mucho, una coma decimal con hasta 2 cifras tras ella.
    private static func filter(_ text: String) -> String {
        var result = ""
        var hasComma = false
        var decimals = 0
        for character in text {
            if character.isNumber {
                if hasComma {
                    guard decimals < 2 else { continue }
                    decimals += 1
                }
                result.append(character)
            } else if character == "," && !hasComma {
                hasComma = true
                result.append(character)
            }
        }
        return result
    }

    private static func decimal(from text: String) -> Decimal {
        Decimal(string: text.replacingOccurrences(of: ",", with: "."), locale: Locale(identifier: "en_US")) ?? 0
    }

    private static func text(from amount: Decimal) -> String {
        amount == 0 ? "" : NSDecimalNumber(decimal: amount).stringValue.replacingOccurrences(of: ".", with: ",")
    }
}

#Preview {
    BalanceFieldPreview()
        .padding(Spacing.screenMargin)
        .background(AppColor.bg)
}

private struct BalanceFieldPreview: View {
    @State private var amount: Decimal = 1250
    var body: some View { BalanceField(amount: $amount) }
}
