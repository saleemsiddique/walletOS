import Foundation

extension WalletSummaryDTO {
    func toDomain() -> WalletSummary {
        WalletSummary(id: id, bankName: bankName, name: name, icon: icon, color: color, balance: balance)
    }
}

extension CategoryDTO {
    func toDomain() -> TransactionCategory {
        TransactionCategory(
            id: id, name: name, icon: icon,
            kind: TransactionCategory.Kind(rawValue: type) ?? .expense, isCustom: isCustom)
    }
}

extension CategorizeResponseDTO {
    func toDomain() -> CategorizationSuggestion {
        CategorizationSuggestion(
            categoryId: categoryId, categoryName: categoryName, categoryIcon: categoryIcon,
            confidence: confidence)
    }
}
