import Foundation

/// Implementación de `BankRepository`: intenta el remoto y cachea en éxito (Rama 6:
/// `BankLocalDataSource`/`WalletLocalDataSource`, sin uso hasta ahora); sin red
/// (`APIError.offline`), reconstruye `[Bank]` desde la cache local.
final class BankRepositoryImpl: BankRepository {
    private let remote: AccountsRemoteDataSource
    private let bankLocal: BankLocalDataSource
    private let walletLocal: WalletLocalDataSource

    init(remote: AccountsRemoteDataSource, bankLocal: BankLocalDataSource, walletLocal: WalletLocalDataSource) {
        self.remote = remote
        self.bankLocal = bankLocal
        self.walletLocal = walletLocal
    }

    func fetchBanks() async throws -> [Bank] {
        do {
            let banks = try await remote.fetchBanks().banks.map { $0.toDomain() }
            try? await cache(banks)
            return banks
        } catch APIError.offline {
            guard let cached = try? await fetchCachedBanks(), !cached.isEmpty else {
                throw APIError.offline
            }
            return cached
        }
    }

    func createBank(name: String, icon: String?, color: String) async throws -> Bank {
        try await remote.createBank(name: name, icon: icon, color: color).toDomain()
    }

    func archiveBank(id: String) async throws {
        try await remote.archiveBank(id: id)
    }

    private func cache(_ banks: [Bank]) async throws {
        let now = ISO8601DateFormatter().string(from: Date())
        for bank in banks {
            try await bankLocal.upsert(
                BankRecord(
                    id: bank.id, name: bank.name, icon: bank.icon, color: bank.color,
                    isArchived: false, createdAt: now, updatedAt: now
                ))
            for wallet in bank.wallets {
                try await walletLocal.upsert(
                    WalletRecord(
                        id: wallet.id, bankId: bank.id, name: wallet.name, type: "CASH",
                        icon: wallet.icon, color: wallet.color,
                        balance: (wallet.balance as NSDecimalNumber).doubleValue,
                        isArchived: false, createdAt: now, updatedAt: now
                    ))
            }
        }
    }

    private func fetchCachedBanks() async throws -> [Bank] {
        let bankRecords = try await bankLocal.fetchAll().filter { !$0.isArchived }
        let walletRecords = try await walletLocal.fetchAll()
        return bankRecords.map { bankRecord in
            let wallets =
                walletRecords
                .filter { $0.bankId == bankRecord.id && !$0.isArchived }
                .map {
                    Wallet(
                        id: $0.id, bankID: $0.bankId, name: $0.name, icon: $0.icon, color: $0.color,
                        balance: Decimal($0.balance))
                }
            return Bank(
                id: bankRecord.id, name: bankRecord.name, icon: bankRecord.icon, color: bankRecord.color,
                wallets: wallets, totalBalance: wallets.reduce(0) { $0 + $1.balance })
        }
    }
}
