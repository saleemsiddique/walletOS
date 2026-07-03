import Foundation

/// Cliente HTTP con `URLSession` async/await. Decodifica JSON (snake_case, fechas ISO-8601),
/// mapea errores a `APIError` y, ante un 401 en rutas autenticadas, refresca el token y reintenta.
final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let interceptor: RequestAuthorizing?
    private let decoder: JSONDecoder

    init(
        baseURL: URL = AppEnvironment.current.baseURL, session: URLSession = .shared,
        interceptor: RequestAuthorizing? = nil
    ) {
        self.baseURL = baseURL
        self.session = session
        self.interceptor = interceptor
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    /// Petición con respuesta decodable.
    func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        let data = try await perform(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    /// Petición sin cuerpo de respuesta (204 No Content).
    func send(_ endpoint: Endpoint) async throws {
        _ = try await perform(endpoint)
    }

    private func perform(_ endpoint: Endpoint, isRetry: Bool = false) async throws -> Data {
        var request = try makeRequest(endpoint)
        if endpoint.requiresAuth, let interceptor {
            request = await interceptor.authorized(request)
        }

        let response: (Data, URLResponse)
        do {
            response = try await session.data(for: request)
        } catch let error as URLError where APIError.isOffline(error) {
            throw APIError.offline
        }

        let (data, urlResponse) = response
        guard let http = urlResponse as? HTTPURLResponse else {
            throw APIError.server(status: -1)
        }

        if http.statusCode == 401, endpoint.requiresAuth, !isRetry, let interceptor {
            try await interceptor.refresh()
            return try await perform(endpoint, isRetry: true)
        }
        if let error = APIError.from(statusCode: http.statusCode, body: data) {
            throw error
        }
        return data
    }

    private func makeRequest(_ endpoint: Endpoint) throws -> URLRequest {
        guard var components = URLComponents(string: baseURL.absoluteString + "/" + endpoint.path) else {
            throw APIError.server(status: -1)
        }
        if !endpoint.query.isEmpty {
            components.queryItems = endpoint.query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else {
            throw APIError.server(status: -1)
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        if let body = endpoint.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }
}
