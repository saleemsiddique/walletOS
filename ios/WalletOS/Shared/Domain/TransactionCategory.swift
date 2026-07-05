import Foundation

/// Categoría de gasto/ingreso (`GET /categories`). `icon` es el emoji del backend; la UI lo traduce
/// a SF Symbol con `IconCatalog`. `isCustom` = creada por el usuario (vs. predefinida del sistema).
struct TransactionCategory: Identifiable, Equatable {
    enum Kind: String {
        case expense = "EXPENSE"
        case income = "INCOME"
    }

    let id: String
    let name: String
    let icon: String
    let kind: Kind
    let isCustom: Bool
}
