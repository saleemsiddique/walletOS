import Foundation

/// Formato de moneda del design system (§5): EUR en locale `es_ES`. Divisa única v1.
///
/// El agrupamiento de miles sigue la convención de `es_ES` (CLDR): a partir de 5 dígitos
/// (`12.345,67 €`); los importes de 4 dígitos van sin separador (`1234,56 €`), como en el resto de iOS.
enum CurrencyFormatter {
    private static let locale = Locale(identifier: "es_ES")

    /// Formatea un importe en euros. Usa `Decimal` para no arrastrar error de coma flotante en dinero.
    static func eur(_ amount: Decimal) -> String {
        amount.formatted(.currency(code: "EUR").locale(locale))
    }
}
