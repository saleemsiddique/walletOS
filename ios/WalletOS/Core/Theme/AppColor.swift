import SwiftUI

/// Tokens de color semánticos del design system (§4). Cada uno resuelve su valor claro/oscuro
/// automáticamente desde el asset catalog; las pantallas consumen estos tokens, nunca hex sueltos.
enum AppColor {
    static let bg = named("bg")
    static let surface = named("surface")
    static let surfaceAlt = named("surfaceAlt")
    static let textPrimary = named("textPrimary")
    static let textSecondary = named("textSecondary")
    static let textOnBrand = named("textOnBrand")
    static let accent = named("accent")
    static let income = named("income")
    static let expense = named("expense")
    static let separator = named("separator")

    private static func named(_ name: String) -> Color {
        Color(name, bundle: .app)
    }
}
