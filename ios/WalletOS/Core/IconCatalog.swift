import Foundation

/// Catálogo bidireccional emoji ↔ SF Symbol (design-system.md §7).
///
/// El backend (Fases 5–6) guarda `icon` como string emoji y no se toca. La UI **nunca** renderiza
/// el emoji: lo traduce a un SF Symbol para mostrar, y al elegir un símbolo en el `IconPicker`
/// guarda en el backend el emoji emparejado.
enum IconCatalog {
    /// Contexto de uso, para elegir el símbolo neutro cuando el emoji no está en el catálogo.
    enum FallbackContext {
        case category
        case bankOrWallet

        var symbol: String {
            switch self {
            case .category: return "ellipsis.circle"
            case .bankOrWallet: return "questionmark.circle"
            }
        }
    }

    /// Pares canónicos (un emoji por símbolo). Fuente de verdad del round-trip y del `IconPicker`.
    private static let canonicalPairs: [(emoji: String, symbol: String)] = [
        ("🍔", "fork.knife"),
        ("🚗", "car.fill"),
        ("🎮", "gamecontroller.fill"),
        ("📱", "apps.iphone"),
        ("🛍", "bag.fill"),
        ("🏥", "cross.case.fill"),
        ("🏠", "house.fill"),
        ("📚", "book.fill"),
        ("💰", "banknote.fill"),
        ("💻", "laptopcomputer"),
        ("📈", "chart.line.uptrend.xyaxis"),
        ("🎁", "gift.fill"),
        ("🏦", "building.columns.fill"),
        ("💳", "creditcard.fill"),
        ("💪", "dumbbell.fill"),
    ]

    /// Emojis alias que comparten símbolo con un par canónico (solo dirección emoji → símbolo).
    private static let aliasEmojis: [(emoji: String, symbol: String)] = [
        ("🏛", "building.columns.fill"),
        ("🏋️", "dumbbell.fill"),
    ]

    private static let symbolByEmoji: [String: String] = {
        var map: [String: String] = [:]
        for pair in canonicalPairs { map[pair.emoji] = pair.symbol }
        for alias in aliasEmojis { map[alias.emoji] = alias.symbol }
        return map
    }()

    private static let emojiBySymbol: [String: String] = {
        var map: [String: String] = [:]
        for pair in canonicalPairs { map[pair.symbol] = pair.emoji }
        return map
    }()

    /// SF Symbol con el que renderizar el `icon` (emoji) del backend; ante uno desconocido devuelve
    /// el símbolo neutro del contexto, nunca el emoji crudo.
    static func symbol(forEmoji emoji: String, fallback context: FallbackContext) -> String {
        symbolByEmoji[emoji] ?? context.symbol
    }

    /// Emoji que el backend espera para un símbolo elegido en el `IconPicker`; `nil` si el símbolo
    /// no pertenece al catálogo.
    static func emoji(forSymbol symbol: String) -> String? {
        emojiBySymbol[symbol]
    }

    /// Símbolos ofrecidos por el `IconPicker`, en el orden del catálogo.
    static var pickerSymbols: [String] {
        canonicalPairs.map(\.symbol)
    }
}
