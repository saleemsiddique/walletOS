import Foundation

/// Acceso a bancos del wallet-service. Lo consume Setup (crear el primero) y, más adelante,
/// Home y Cuentas (listarlos). El resto de la app solo ve este protocolo.
protocol BankRepository {
    /// `GET /banks` — bancos no archivados con sus wallets y balances calculados por el backend.
    func fetchBanks() async throws -> [Bank]
    /// `POST /banks` — crea un banco y lo devuelve (todavía sin wallets). `icon` es la clave del
    /// `BankCatalog` si el usuario reconoció su banco en el buscador; `nil` si no, y el backend
    /// aplica su valor por defecto.
    func createBank(name: String, icon: String?, color: String) async throws -> Bank
}
