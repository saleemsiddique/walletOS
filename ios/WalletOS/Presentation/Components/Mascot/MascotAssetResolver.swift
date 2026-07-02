import Foundation

/// Qué debe pintar `MascotView` tras aplicar la cascada de fallback.
enum MascotRendering: Equatable {
    case video(URL, loops: Bool)
    case placeholder(imageName: String)
}

/// Resuelve el asset de la mascota (design-system.md §3): clip del gesto → clip idle del estado →
/// PNG del estado. Con Reduce Motion siempre PNG. Lógica pura, sin reproducción, para poder testearla.
enum MascotAssetResolver {
    /// - Parameter clipLocator: localiza el clip por nombre base (sin extensión). Inyectable en tests.
    static func rendering(
        state: MascotState,
        gesture: MascotGesture,
        reduceMotion: Bool,
        clipLocator: (String) -> URL? = bundleClip
    ) -> MascotRendering {
        guard !reduceMotion else {
            return .placeholder(imageName: state.placeholderImageName)
        }
        if let url = clipLocator("mascot_\(state.rawValue)_\(gesture.rawValue)") {
            return .video(url, loops: gesture.loops)
        }
        if gesture != .idle, let idleURL = clipLocator("mascot_\(state.rawValue)_idle") {
            return .video(idleURL, loops: MascotGesture.idle.loops)
        }
        return .placeholder(imageName: state.placeholderImageName)
    }

    /// Localizador por defecto: busca el `.mp4` en `Resources/Mascot/` del bundle de la app.
    static func bundleClip(_ name: String) -> URL? {
        Bundle.app.url(forResource: name, withExtension: "mp4")
    }
}
