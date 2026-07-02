import XCTest

@testable import WalletOS

final class MascotAssetResolverTests: XCTestCase {
    private let clip = URL(fileURLWithPath: "/tmp/clip.mp4")
    private let idleClip = URL(fileURLWithPath: "/tmp/idle.mp4")

    func testReduceMotionAlwaysRendersPlaceholder() {
        let rendering = MascotAssetResolver.rendering(
            state: .happy,
            gesture: .count,
            reduceMotion: true,
            clipLocator: { _ in self.clip }  // aunque exista el clip, gana el PNG
        )
        XCTAssertEqual(rendering, .placeholder(imageName: "mascot_happy"))
    }

    func testUsesGestureClipWhenItExists() {
        let rendering = MascotAssetResolver.rendering(
            state: .happy,
            gesture: .count,
            reduceMotion: false,
            clipLocator: { name in name == "mascot_happy_count" ? self.clip : nil }
        )
        XCTAssertEqual(rendering, .video(clip, loops: false))
    }

    func testFallsBackToStateIdleWhenGestureClipMissing() {
        let rendering = MascotAssetResolver.rendering(
            state: .serene,
            gesture: .wave,
            reduceMotion: false,
            clipLocator: { name in name == "mascot_serene_idle" ? self.idleClip : nil }
        )
        XCTAssertEqual(rendering, .video(idleClip, loops: true))
    }

    func testFallsBackToPlaceholderWhenNoClipExists() {
        let rendering = MascotAssetResolver.rendering(
            state: .empty,
            gesture: .cry,
            reduceMotion: false,
            clipLocator: { _ in nil }
        )
        XCTAssertEqual(rendering, .placeholder(imageName: "mascot_empty"))
    }
}
