import SwiftUI

/// Tokens de color semánticos del design system (§4). Cada uno resuelve su valor claro/oscuro
/// automáticamente desde el asset catalog; las pantallas consumen estos tokens, nunca hex sueltos.
enum AppColor {
    static let bg = named("bg")
    static let surface = named("surface")
    static let ink = named("ink")
    static let inkSoft = named("inkSoft")
    static let onAccent = named("onAccent")
    static let accent = named("accent")
    static let income = named("income")
    static let expense = named("expense")
    static let hairline = named("hairline")

    private static func named(_ name: String) -> Color {
        Color(name, bundle: .app)
    }
}
