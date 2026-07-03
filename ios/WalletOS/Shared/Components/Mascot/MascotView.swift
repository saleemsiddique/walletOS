import AVFoundation
import SwiftUI

/// Personaje reactivo. Las pantallas solo declaran estado y gesto; el motor resuelve el clip con
/// fallback a idle y a PNG (design-system.md §3), respeta Reduce Motion y expone su estado a VoiceOver.
struct MascotView: View {
    let state: MascotState
    var gesture: MascotGesture = .idle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var activeGesture: MascotGesture = .idle

    var body: some View {
        rendering
            .animation(.easeInOut(duration: Motion.mascotCrossfade), value: state)
            .accessibilityElement()
            .accessibilityLabel(state.accessibilityLabel)
            .onAppear { activeGesture = gesture }
            .onChange(of: gesture) { activeGesture = $0 }
    }

    @ViewBuilder
    private var rendering: some View {
        switch MascotAssetResolver.rendering(state: state, gesture: activeGesture, reduceMotion: reduceMotion) {
        case .placeholder(let imageName):
            Image(imageName, bundle: .app)
                .resizable()
                .scaledToFit()
                .transition(.opacity)
                .id(state)
        case .video(let url, let loops):
            MascotVideoView(url: url, loops: loops) {
                activeGesture = .idle
            }
            .aspectRatio(1, contentMode: .fit)
            .transition(.opacity)
            .id(url)
        }
    }
}

/// Reproduce un clip de la mascota sin controles ni audio: loop continuo (`AVPlayerLooper`) o una
/// vez (avisa al terminar para volver a idle).
struct MascotVideoView: UIViewRepresentable {
    let url: URL
    let loops: Bool
    var onFinished: (() -> Void)?

    func makeUIView(context: Context) -> MascotPlayerView {
        let view = MascotPlayerView()
        view.play(url: url, loops: loops, onFinished: onFinished)
        return view
    }

    func updateUIView(_ uiView: MascotPlayerView, context: Context) {
        uiView.play(url: url, loops: loops, onFinished: onFinished)
    }
}

/// UIView cuyo backing layer es un `AVPlayerLayer`, para pintar el vídeo a pantalla completa del slot.
final class MascotPlayerView: UIView {
    // swiftlint:disable:next static_over_final_class
    override class var layerClass: AnyClass { AVPlayerLayer.self }

    // swiftlint:disable:next force_cast
    private var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    private var looper: AVPlayerLooper?
    private var endObserver: NSObjectProtocol?
    private var currentURL: URL?

    func play(url: URL, loops: Bool, onFinished: (() -> Void)?) {
        guard currentURL != url else { return }
        currentURL = url
        teardown()
        playerLayer.videoGravity = .resizeAspect

        if loops {
            let queuePlayer = AVQueuePlayer()
            queuePlayer.isMuted = true
            looper = AVPlayerLooper(player: queuePlayer, templateItem: AVPlayerItem(url: url))
            playerLayer.player = queuePlayer
            queuePlayer.play()
        } else {
            let player = AVPlayer(url: url)
            player.isMuted = true
            playerLayer.player = player
            endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: player.currentItem,
                queue: .main
            ) { _ in onFinished?() }
            player.play()
        }
    }

    private func teardown() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        looper = nil
        playerLayer.player = nil
    }

    deinit {
        teardown()
    }
}
