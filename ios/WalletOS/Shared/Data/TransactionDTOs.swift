import Foundation

/// Cuerpo de `POST /wallets/:id/transactions`. `id` es el UUID de cliente (idempotencia
/// offline-first); `date` en formato `yyyy-MM-dd`.
struct CreateTransactionRequestDTO: Codable {
    let id: String
    let type: String
    let amount: Decimal
    let categoryId: String?
    let note: String?
    let date: String
}

/// Cuerpo de `POST /transfers`. Sin categoría (las transferencias no la tienen).
struct CreateTransferRequestDTO: Codable {
    let fromWalletId: String
    let toWalletId: String
    let amount: Decimal
    let note: String?
    let date: String
}

/// Cuerpo de `PATCH /transactions/:id`. Todos opcionales; aquí se envía el conjunto editable.
struct UpdateTransactionRequestDTO: Encodable {
    let type: String
    let amount: Decimal
    let categoryId: String?
    let note: String?
    let date: String
}

/// Transacción devuelta por `POST /wallets/:id/transactions` (y las patas de `POST /transfers`).
/// `date`/`createdAt` como `String`: `date` es año-mes-día, incompatible con el `iso8601` del decoder.
struct TransactionDTO: Decodable {
    let id: String
    let walletId: String
    let walletName: String
    let bankName: String
    let type: String
    let amount: Decimal
    let category: DashboardCategoryDTO?
    let note: String?
    let date: String
    let transferId: String?
    let pairedWalletName: String?
    let createdAt: String
}
