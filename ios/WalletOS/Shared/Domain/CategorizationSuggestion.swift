import Foundation

/// Resultado de `POST /categorize`: categoría sugerida por IA para una nota. `categoryId` es `nil`
/// cuando `confidence < 0.5` (el backend no arriesga una sugerencia débil).
struct CategorizationSuggestion: Equatable {
    let categoryId: String?
    let categoryName: String?
    let categoryIcon: String?
    let confidence: Double

    /// El modal solo preselecciona la categoría si el backend devolvió una con confianza suficiente.
    var hasConfidentMatch: Bool { categoryId != nil }
}
