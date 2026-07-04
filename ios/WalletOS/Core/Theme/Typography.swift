import SwiftUI

/// Roles tipográficos del design system "Ledger" (§3): dos voces del sistema — SF Pro para la
/// interfaz y SF Mono para los datos (todo número). Anclados a text styles para Dynamic Type.
enum Typography {
    /// La cifra protagonista de cada pantalla (patrimonio, total del periodo).
    static var hero: Font { .system(.largeTitle, design: .monospaced).weight(.semibold) }
    static var title: Font { .system(.title).weight(.bold) }
    static var headline: Font { .system(.headline) }
    static var body: Font { .system(.body) }
    /// Importes en filas y columnas; SF Mono alinea sin `tabular-nums` manual.
    static var amount: Font { .system(.body, design: .monospaced).weight(.medium) }
    static var caption: Font { .system(.caption) }
}
