import XCTest

@testable import WalletOS

final class MascotModelsTests: XCTestCase {
    func testEachStateHasADistinctVoiceOverLabel() {
        let labels = Set(MascotState.allCases.map(\.accessibilityLabel))
        XCTAssertEqual(labels.count, MascotState.allCases.count)
        XCTAssertEqual(MascotState.happy.accessibilityLabel, "Tu cartera: balance saludable")
        XCTAssertEqual(MascotState.empty.accessibilityLabel, "Tu cartera: vacía")
    }

    func testPlaceholderImageNameMatchesAssetConvention() {
        XCTAssertEqual(MascotState.overflow.placeholderImageName, "mascot_overflow")
    }

    func testContinuousGesturesLoopAndOneShotGesturesDoNot() {
        XCTAssertTrue(MascotGesture.idle.loops)
        XCTAssertTrue(MascotGesture.cry.loops)
        XCTAssertTrue(MascotGesture.narrate.loops)
        XCTAssertTrue(MascotGesture.thinking.loops)
        XCTAssertTrue(MascotGesture.shrug.loops)
        XCTAssertFalse(MascotGesture.wave.loops)
        XCTAssertFalse(MascotGesture.count.loops)
        XCTAssertFalse(MascotGesture.celebrate.loops)
        XCTAssertFalse(MascotGesture.loseMoney.loops)
    }

    func testLoseMoneyGestureMapsToCatalogClipName() {
        XCTAssertEqual(MascotGesture.loseMoney.rawValue, "lose")
    }

    func testSlotSizesFollowDesignSystem() {
        XCTAssertEqual(MascotSlot.hero.size, 200)
        XCTAssertEqual(MascotSlot.panel.size, 140)
        XCTAssertEqual(MascotSlot.inline.size, 88)
        XCTAssertEqual(MascotSlot.widget.size, 56)
    }
}
