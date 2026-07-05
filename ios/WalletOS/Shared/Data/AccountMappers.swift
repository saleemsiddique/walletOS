import Foundation

extension BankDTO {
    func toDomain() -> Bank {
        Bank(
            id: id,
            name: name,
            icon: icon,
            color: color,
            wallets: (wallets ?? []).map { $0.toDomain(fallbackBankID: id) },
            totalBalance: totalBalance ?? 0
        )
    }
}

extension WalletDTO {
    /// `fallbackBankID` cubre los wallets anidados de `GET /banks`, que no traen `bank_id` propio:
    /// se toma el del banco contenedor.
    func toDomain(fallbackBankID: String) -> Wallet {
        Wallet(
            id: id,
            bankID: bankId ?? fallbackBankID,
            name: name,
            icon: icon,
            color: color,
            balance: balance
        )
    }
}
