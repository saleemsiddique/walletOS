import Foundation

/// Fila aplanada de wallet+banco para la lista plana de Patrimonio (regla §7.3: sin secciones por
/// banco). El flatten de `[Bank]` es UI-level — no vive en `AccountMappers.swift` (DTO → dominio).
struct HomeWalletRow: Identifiable, Equatable {
    let id: String
    let name: String
    let bankName: String
    let balance: Decimal
}

extension Array where Element == Bank {
    /// Aplana los bancos a sus wallets, en el mismo orden en que llegan del backend (orden "banco").
    func flattenedWalletRows() -> [HomeWalletRow] {
        flatMap { bank in
            bank.wallets.map { wallet in
                HomeWalletRow(id: wallet.id, name: wallet.name, bankName: bank.name, balance: wallet.balance)
            }
        }
    }
}
