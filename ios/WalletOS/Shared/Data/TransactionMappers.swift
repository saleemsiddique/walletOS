import Foundation

extension TransactionDTO {
    func toEditable() -> EditableTransaction {
        EditableTransaction(
            id: id, walletId: walletId, type: type, amount: amount,
            categoryId: category?.id, note: note, date: date, transferId: transferId)
    }
}
