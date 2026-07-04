import Foundation

/// Errores de la capa de red, mapeados desde los códigos HTTP del backend y desde `URLError`.
enum APIError: Error, Equatable {
    case unauthorized
    case notFound
    case validation(details: String?)
    case conflict(details: String?)
    case rateLimited
    case server(status: Int)
    case offline
    case decoding

    /// Mapea un código HTTP a su caso. `nil` para 2xx (no es error).
    static func from(statusCode: Int, body: Data?) -> APIError? {
        switch statusCode {
        case 200..<300: return nil
        case 401: return .unauthorized
        case 404: return .notFound
        case 400, 422: return .validation(details: body.flatMap { String(data: $0, encoding: .utf8) })
        case 409: return .conflict(details: body.flatMap { String(data: $0, encoding: .utf8) })
        case 429: return .rateLimited
        default: return .server(status: statusCode)
        }
    }

    /// `true` si el `URLError` indica falta de conectividad (degradar a datos cacheados).
    static func isOffline(_ error: URLError) -> Bool {
        [.notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost, .dataNotAllowed]
            .contains(error.code)
    }
}
