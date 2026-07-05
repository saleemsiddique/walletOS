import Foundation

/// Banco reconocido del catálogo (`BankCatalog`). `key` es el identificador estable que viaja en el
/// campo `icon` del backend (string libre, ver `bank.validators.ts`) para que la app pueda volver a
/// resolver el logo tras un `GET /banks`, sin que el backend sepa nada de bancos ni de marcas.
struct BankCatalogEntry: Identifiable, Equatable {
    let key: String
    let displayName: String
    let brandColorHex: String

    var id: String { key }

    /// Nombre del asset en `Assets.xcassets` con el logo real (con licencia) del banco. Mientras no
    /// exista ese asset, `BankLogoView` cae a un monograma con `brandColorHex`.
    var assetName: String { "bank-logo-\(key)" }
}
