import Foundation

/// Descripción de una petición al backend, independiente de `URLSession`.
struct Endpoint {
    enum Method: String {
        case get = "GET"
        case post = "POST"
        case patch = "PATCH"
        case delete = "DELETE"
    }

    let path: String
    let method: Method
    var query: [String: String] = [:]
    var body: Data?
    var requiresAuth: Bool = true
}
