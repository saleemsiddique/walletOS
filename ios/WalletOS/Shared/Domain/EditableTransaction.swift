import Foundation

/// Transacción con sus ids resueltos (`GET /transactions/:id`), para precargar el modal en modo
/// edición. `transferId != nil` marca una pata de transferencia — no editable (se borra y recrea).
struct EditableTransaction: Equatable {
    let id: String
    let walletId: String
    let type: String
    let amount: Decimal
    let categoryId: String?
    let note: String?
    let date: String
    let transferId: String?

    var isTransfer: Bool { transferId != nil }
}
