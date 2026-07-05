import SwiftUI
import UIKit

extension Color {
    /// Crea un color desde un hex `#RRGGBB` (el formato que el backend guarda para bancos y wallets).
    /// Un hex inválido cae a negro; los colores válidos vienen siempre del backend o de la paleta local.
    init(hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        self.init(red: red, green: green, blue: blue)
    }

    /// Hex `#RRGGBB` a partir de este color — inverso de `init(hex:)`, usado para persistir lo que
    /// el usuario elija en el `ColorPicker` nativo en el mismo formato que espera el backend.
    var hexString: String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        UIColor(self).getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return String(format: "#%02X%02X%02X", Int(round(red * 255)), Int(round(green * 255)), Int(round(blue * 255)))
    }
}
