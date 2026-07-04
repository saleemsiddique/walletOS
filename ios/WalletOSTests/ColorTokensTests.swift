import UIKit
import XCTest

@testable import WalletOS

/// Verifica que cada token de color resuelve valores distintos en claro/oscuro y que los pares
/// texto/fondo cumplen WCAG AA (design-system.md §4, §12).
final class ColorTokensTests: XCTestCase {
    private let light = UITraitCollection(userInterfaceStyle: .light)
    private let dark = UITraitCollection(userInterfaceStyle: .dark)

    private func color(_ name: String, _ traits: UITraitCollection) throws -> UIColor {
        let dynamic = try XCTUnwrap(UIColor(named: name, in: .app, compatibleWith: nil), "falta el color '\(name)'")
        return dynamic.resolvedColor(with: traits)
    }

    func testThemedTokensResolveDifferentValuesInLightAndDark() throws {
        let themed = [
            "bg", "surface", "surfaceAlt", "textPrimary", "textSecondary", "textOnBrand", "accent", "income", "expense",
            "separator",
        ]
        for name in themed {
            let lightColor = try color(name, light)
            let darkColor = try color(name, dark)
            XCTAssertNotEqual(lightColor, darkColor, "'\(name)' debería diferir entre claro y oscuro")
        }
    }

    func testTextOnBackgroundPairsMeetContrastAA() throws {
        // Umbral AA para texto normal. Los importes income/expense se validan sobre `surface`
        // (donde viven en tarjetas), que es donde el design-system garantiza el contraste.
        let minimum = 4.5
        let pairs = [
            ContrastCase("textPrimary", "bg", light),
            ContrastCase("textSecondary", "bg", light),
            ContrastCase("textPrimary", "surface", light),
            ContrastCase("textSecondary", "surface", light),
            ContrastCase("textOnBrand", "accent", light),
            ContrastCase("income", "surface", light),
            ContrastCase("expense", "surface", light),
            ContrastCase("textPrimary", "bg", dark),
            ContrastCase("textSecondary", "bg", dark),
            ContrastCase("textOnBrand", "accent", dark),
            ContrastCase("income", "bg", dark),
            ContrastCase("expense", "bg", dark),
        ]
        for pair in pairs {
            let ratio = contrastRatio(try color(pair.foreground, pair.traits), try color(pair.background, pair.traits))
            XCTAssertGreaterThanOrEqual(ratio, minimum, "\(pair.label) = \(String(format: "%.2f", ratio))")
        }
    }

    private struct ContrastCase {
        let foreground: String
        let background: String
        let traits: UITraitCollection

        init(_ foreground: String, _ background: String, _ traits: UITraitCollection) {
            self.foreground = foreground
            self.background = background
            self.traits = traits
        }

        var label: String {
            let style = traits.userInterfaceStyle == .dark ? "dark" : "light"
            return "\(foreground)/\(background) \(style)"
        }
    }

    private func contrastRatio(_ first: UIColor, _ second: UIColor) -> Double {
        let lighter = max(relativeLuminance(first), relativeLuminance(second))
        let darker = min(relativeLuminance(first), relativeLuminance(second))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private func relativeLuminance(_ color: UIColor) -> Double {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        color.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        func linear(_ component: CGFloat) -> Double {
            let value = Double(component)
            return value <= 0.03928 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    }
}
