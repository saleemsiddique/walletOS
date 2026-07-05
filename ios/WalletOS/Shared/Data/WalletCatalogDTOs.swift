import Foundation

/// Respuesta de `GET /wallets`: lista plana de wallets con `bank_name` ya resuelto.
struct WalletsResponseDTO: Decodable {
    let wallets: [WalletSummaryDTO]
}

struct WalletSummaryDTO: Decodable {
    let id: String
    let bankName: String
    let name: String
    let icon: String
    let color: String
    let balance: Decimal
}

/// Respuesta de `GET /categories`.
struct CategoriesResponseDTO: Decodable {
    let categories: [CategoryDTO]
}

struct CategoryDTO: Decodable {
    let id: String
    let name: String
    let icon: String
    let type: String
    let isCustom: Bool
}

/// Cuerpo y respuesta de `POST /categorize`.
struct CategorizeRequestDTO: Encodable {
    let note: String
    let type: String
}

struct CategorizeResponseDTO: Decodable {
    let categoryId: String?
    let categoryName: String?
    let categoryIcon: String?
    let confidence: Double
}
