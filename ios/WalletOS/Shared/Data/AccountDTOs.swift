import Foundation

/// Respuesta de `GET /banks`: bancos con wallets y el patrimonio agregado.
struct BanksResponseDTO: Decodable {
    let banks: [BankDTO]
    let totalBalance: Decimal
}

/// Banco del backend. Sirve para `GET /banks` (con `wallets`/`totalBalance`) y para `POST /banks`
/// (que los omite): por eso ambos son opcionales.
struct BankDTO: Decodable {
    let id: String
    let name: String
    let icon: String
    let color: String
    let wallets: [WalletDTO]?
    let totalBalance: Decimal?
}

/// Wallet del backend. `bankId` viaja en `POST /banks/:id/wallets` y `GET /wallets`, pero no en los
/// wallets anidados de `GET /banks` (ahí el banco es el contenedor): por eso es opcional.
struct WalletDTO: Decodable {
    let id: String
    let bankId: String?
    let name: String
    let icon: String
    let color: String
    let balance: Decimal
}

/// `icon` viaja solo si el usuario eligió un banco del catálogo (`BankCatalog`); si no, se omite
/// y el backend aplica su propio valor por defecto.
struct CreateBankRequestDTO: Encodable {
    let name: String
    let icon: String?
    let color: String
}

/// Sin `icon`: los wallets no tienen selector de icono (ver `SetupViewModel`), el backend aplica
/// siempre su valor por defecto (`💳`).
struct CreateWalletRequestDTO: Encodable {
    let name: String
    let type: String
    let initialBalance: Decimal
    let color: String
}
