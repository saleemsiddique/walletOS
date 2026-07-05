import Foundation

/// Catálogo de bancos reconocidos, para que el usuario los encuentre por nombre en el Setup en vez
/// de elegir un icono genérico. Los `assetName` apuntan a logos reales con licencia que **no**
/// existen todavía en `Assets.xcassets` (incrustar marcas registradas sin acuerdo con cada banco es
/// un riesgo legal): hasta que se añadan, `BankLogoView` muestra un monograma con `brandColorHex`.
/// Bancos con presencia en España más algunos digitales internacionales habituales.
enum BankCatalog {
    static let entries: [BankCatalogEntry] = [
        .init(key: "santander", displayName: "Santander", brandColorHex: "#EC0000"),
        .init(key: "bbva", displayName: "BBVA", brandColorHex: "#004481"),
        .init(key: "caixabank", displayName: "CaixaBank", brandColorHex: "#00AEEF"),
        .init(key: "sabadell", displayName: "Banco Sabadell", brandColorHex: "#0057B8"),
        .init(key: "bankinter", displayName: "Bankinter", brandColorHex: "#FF6600"),
        .init(key: "ing", displayName: "ING", brandColorHex: "#FF6200"),
        .init(key: "unicaja", displayName: "Unicaja Banco", brandColorHex: "#00A19A"),
        .init(key: "kutxabank", displayName: "Kutxabank", brandColorHex: "#E30613"),
        .init(key: "abanca", displayName: "ABANCA", brandColorHex: "#0072BC"),
        .init(key: "openbank", displayName: "Openbank", brandColorHex: "#00E6B5"),
        .init(key: "revolut", displayName: "Revolut", brandColorHex: "#0075EB"),
        .init(key: "n26", displayName: "N26", brandColorHex: "#36A18B"),
        .init(key: "wise", displayName: "Wise", brandColorHex: "#9FE870"),
        .init(key: "evobanco", displayName: "EVO Banco", brandColorHex: "#E2001A"),
        .init(key: "bancamarch", displayName: "Banca March", brandColorHex: "#003057"),
        .init(key: "myinvestor", displayName: "MyInvestor", brandColorHex: "#FF4F00"),
        .init(key: "traderepublic", displayName: "Trade Republic", brandColorHex: "#000000"),
        .init(key: "deutschebank", displayName: "Deutsche Bank", brandColorHex: "#0018A8"),
    ]

    private static let entriesByKey: [String: BankCatalogEntry] = {
        Dictionary(uniqueKeysWithValues: entries.map { ($0.key, $0) })
    }()

    static func entry(forKey key: String?) -> BankCatalogEntry? {
        guard let key else { return nil }
        return entriesByKey[key]
    }

    /// Coincidencias por nombre, sin distinguir mayúsculas ni acentos (`"bbva"` encuentra `"BBVA"`,
    /// `"santan"` encuentra `"Santander"`). Vacía si `query` está vacío.
    static func search(_ query: String) -> [BankCatalogEntry] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        return entries.filter {
            $0.displayName.range(
                of: trimmed,
                options: [.caseInsensitive, .diacriticInsensitive]
            ) != nil
        }
    }
}
