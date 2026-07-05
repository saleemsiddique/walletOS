import SwiftUI
import XCTest

@testable import WalletOS

final class ColorHexTests: XCTestCase {
    func testHexRoundTripsThroughColor() {
        for hex in ["#007AFF", "#EC0000", "#000000", "#FFFFFF", "#30D158"] {
            XCTAssertEqual(Color(hex: hex).hexString, hex, "el hex debe sobrevivir intacto al ida y vuelta")
        }
    }

    func testAccountColorPickerPaletteHasNoDuplicates() {
        let uppercased = AccountColorPicker.palette.map { $0.uppercased() }
        XCTAssertEqual(uppercased.count, Set(uppercased).count, "no debe haber colores repetidos en la paleta")
    }

    func testAccountColorPickerPaletteIncludesBankBrandColors() {
        XCTAssertTrue(AccountColorPicker.palette.contains("#EC0000"), "Santander debería estar en la paleta rápida")
    }
}
