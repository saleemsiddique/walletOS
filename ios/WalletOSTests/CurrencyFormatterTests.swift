import XCTest

@testable import WalletOS

final class CurrencyFormatterTests: XCTestCase {
    /// Normaliza el espacio (es_ES usa un espacio duro U+00A0 antes de €) para comparar de forma estable.
    private func normalized(_ value: String) -> String {
        value.replacingOccurrences(of: "\u{00A0}", with: " ")
    }

    func testFormatsPositiveAmount() {
        XCTAssertEqual(normalized(CurrencyFormatter.eur(1234.56)), "1234,56 €")
    }

    func testGroupsThousandsFromFiveDigits() {
        XCTAssertEqual(normalized(CurrencyFormatter.eur(12345.67)), "12.345,67 €")
    }

    func testFormatsNegativeAmount() {
        XCTAssertEqual(normalized(CurrencyFormatter.eur(-1234.56)), "-1234,56 €")
    }

    func testFormatsZero() {
        XCTAssertEqual(normalized(CurrencyFormatter.eur(0)), "0,00 €")
    }
}
