import SwiftUI

/// Roles tipográficos del design system (§5). SF Pro Rounded anclado a los text styles del sistema
/// para respetar Dynamic Type; los importes usan dígitos monoespaciados para alinear en columnas.
enum Typography {
    static var balance: Font { .system(.largeTitle, design: .rounded).weight(.bold).monospacedDigit() }
    static var title: Font { .system(.title, design: .rounded).weight(.bold) }
    static var headline: Font { .system(.title3, design: .rounded).weight(.semibold) }
    static var body: Font { .system(.body, design: .rounded) }
    static var amount: Font { .system(.body, design: .rounded).weight(.semibold).monospacedDigit() }
    static var caption: Font { .system(.caption, design: .rounded) }
}
