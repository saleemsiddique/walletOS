import Foundation

/// Deep links propios de la app (`walletos://...`).
enum DeepLink: Equatable {
    case resetPassword(token: String)
}

/// Traduce URLs entrantes a rutas de la app. Lógica pura para poder testear el parseo.
enum DeepLinkRouter {
    static func deepLink(from url: URL) -> DeepLink? {
        guard url.scheme == "walletos" else { return nil }
        switch url.host {
        case "reset":
            let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first { $0.name == "token" }?
                .value
            guard let token, !token.isEmpty else { return nil }
            return .resetPassword(token: token)
        default:
            return nil
        }
    }
}
