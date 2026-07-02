import XCTest

@testable import WalletOS

final class IconCatalogTests: XCTestCase {
    func testKnownEmojiResolvesToItsSymbol() {
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "🍔", fallback: .category), "fork.knife")
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "🏦", fallback: .bankOrWallet), "building.columns.fill")
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "💳", fallback: .bankOrWallet), "creditcard.fill")
    }

    func testAliasEmojiResolvesToTheSharedSymbol() {
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "🏛", fallback: .bankOrWallet), "building.columns.fill")
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "🏋️", fallback: .category), "dumbbell.fill")
    }

    func testUnknownEmojiFallsBackByContext() {
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "🦄", fallback: .category), "ellipsis.circle")
        XCTAssertEqual(IconCatalog.symbol(forEmoji: "🦄", fallback: .bankOrWallet), "questionmark.circle")
    }

    func testSymbolNotInCatalogHasNoEmoji() {
        XCTAssertNil(IconCatalog.emoji(forSymbol: "ellipsis.circle"))
        XCTAssertNil(IconCatalog.emoji(forSymbol: "flame.fill"))
    }

    func testPickerSymbolsRoundTripToTheirEmojiAndBack() throws {
        for symbol in IconCatalog.pickerSymbols {
            let emoji = try XCTUnwrap(IconCatalog.emoji(forSymbol: symbol), "símbolo del picker sin emoji: \(symbol)")
            XCTAssertEqual(
                IconCatalog.symbol(forEmoji: emoji, fallback: .category),
                symbol,
                "round-trip roto para \(symbol)"
            )
        }
    }
}
