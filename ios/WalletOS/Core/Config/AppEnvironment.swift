import Foundation

/// Entorno de backend al que apunta la app. Cambiar de entorno reapunta todas las requests sin
/// tocar lógica de red.
enum AppEnvironment: String, CaseIterable {
    case local
    case staging
    case prod

    var baseURL: URL {
        switch self {
        case .local:
            return URL(string: "http://localhost/api")!
        case .staging:
            return URL(string: "https://staging-api.walletos.app/api")!
        case .prod:
            return URL(string: "https://api.walletos.app/api")!
        }
    }

    /// Entorno activo: `local` en Debug salvo override guardado (ajuste de debug oculto);
    /// `prod` en Release.
    static var current: AppEnvironment {
        #if DEBUG
        let overrideValue = UserDefaults.standard.string(forKey: overrideKey)
        return overrideValue.flatMap(AppEnvironment.init(rawValue:)) ?? .local
        #else
        return .prod
        #endif
    }

    private static let overrideKey = "com.walletOS.debug.environmentOverride"

    /// Fuerza un entorno desde el ajuste de debug oculto. Solo tiene efecto en builds Debug.
    static func overrideForDebug(_ environment: AppEnvironment) {
        UserDefaults.standard.set(environment.rawValue, forKey: overrideKey)
    }

    /// Limpia el override de debug; `current` vuelve a resolver por build configuration.
    static func clearDebugOverride() {
        UserDefaults.standard.removeObject(forKey: overrideKey)
    }
}
