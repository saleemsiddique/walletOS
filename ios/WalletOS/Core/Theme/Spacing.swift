import CoreGraphics

/// Escala de espaciado base-4 del design system (§6). El margen de pantalla estándar es `md` (16).
enum Spacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32

    static let screenMargin: CGFloat = md
}
