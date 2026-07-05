/// Los tres modos del toggle del modal de transacción. Gasto e ingreso crean una transacción
/// (`POST /wallets/:id/transactions`, offline-first); transferencia usa `POST /transfers` (directo,
/// sin categoría).
enum TransactionMode: CaseIterable {
    case expense
    case income
    case transfer

    /// Valor `type` que espera el backend para gasto/ingreso; `nil` para transferencia (otro endpoint).
    var apiType: String? {
        switch self {
        case .expense: return "EXPENSE"
        case .income: return "INCOME"
        case .transfer: return nil
        }
    }

    /// Tipo de categoría a listar (transferencia no tiene, cae en gasto por defecto sin usarse).
    var categoryKind: TransactionCategory.Kind {
        self == .income ? .income : .expense
    }

    var title: String {
        switch self {
        case .expense: return "Gasto"
        case .income: return "Ingreso"
        case .transfer: return "Transferencia"
        }
    }
}
