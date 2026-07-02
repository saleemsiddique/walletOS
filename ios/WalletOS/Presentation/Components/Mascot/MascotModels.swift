import CoreGraphics

/// Estado de la mascota = termómetro de dinero (design-system.md §2). El Home lo deriva del balance.
enum MascotState: String, CaseIterable {
    case empty
    case serene
    case happy
    case overflow

    /// Nombre del PNG base del estado en el asset catalog (fallback sin vídeo).
    var placeholderImageName: String { "mascot_\(rawValue)" }

    /// Etiqueta VoiceOver del personaje (design-system.md §12).
    var accessibilityLabel: String {
        switch self {
        case .empty: return "Tu cartera: vacía"
        case .serene: return "Tu cartera: en calma"
        case .happy: return "Tu cartera: balance saludable"
        case .overflow: return "Tu cartera: rebosante"
        }
    }
}

/// Gesto de la mascota. El `rawValue` forma el nombre del clip `mascot_<estado>_<gesto>.mp4`
/// (ver `docs/mascot-animation-catalog.md`).
enum MascotGesture: String {
    case idle
    case wave
    case count
    case celebrate
    case cry
    case loseMoney = "lose"
    case narrate
    case thinking

    /// `true` = loop continuo; `false` = se reproduce una vez y vuelve a `idle` del estado.
    var loops: Bool {
        switch self {
        case .idle, .cry, .narrate, .thinking: return true
        case .wave, .count, .celebrate, .loseMoney: return false
        }
    }
}

/// Tamaños de slot del personaje en puntos (design-system.md §3).
enum MascotSlot {
    case hero
    case panel
    case inline
    case widget

    var size: CGFloat {
        switch self {
        case .hero: return 200
        case .panel: return 140
        case .inline: return 88
        case .widget: return 56
        }
    }
}
