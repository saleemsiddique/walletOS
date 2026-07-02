import Foundation

/// Añade el `Authorization: Bearer` a las peticiones y, ante un 401, refresca el token una sola vez
/// (coalescing de refresh concurrente vía actor). Si el refresh falla, emite el evento de logout.
actor AuthInterceptor: RequestAuthorizing {
    private let tokenStore: TokenStoring
    private let session: URLSession
    private let baseURL: URL
    private let onLogout: @Sendable () -> Void
    private var refreshInFlight: Task<Void, Error>?

    init(
        tokenStore: TokenStoring,
        session: URLSession,
        baseURL: URL,
        onLogout: @escaping @Sendable () -> Void
    ) {
        self.tokenStore = tokenStore
        self.session = session
        self.baseURL = baseURL
        self.onLogout = onLogout
    }

    /// Devuelve la petición con el access token inyectado (si hay sesión).
    func authorized(_ request: URLRequest) async -> URLRequest {
        var authorized = request
        if let token = await tokenStore.accessToken {
            authorized.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return authorized
    }

    /// Refresca el token. Las llamadas concurrentes se unen a un único `POST /refresh` en vuelo.
    func refresh() async throws {
        if let refreshInFlight {
            return try await refreshInFlight.value
        }
        let task = Task { try await performRefresh() }
        refreshInFlight = task
        defer { refreshInFlight = nil }
        try await task.value
    }

    private func performRefresh() async throws {
        guard let refreshToken = await tokenStore.refreshToken else {
            onLogout()
            throw APIError.unauthorized
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("refresh"))
        request.httpMethod = Endpoint.Method.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(RefreshRequest(refreshToken: refreshToken))

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.server(status: -1)
        }
        if http.statusCode == 401 {
            onLogout()
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(status: http.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let tokens = try decoder.decode(TokenResponse.self, from: data)
        await tokenStore.saveTokens(access: tokens.accessToken, refresh: tokens.refreshToken)
    }
}

private struct RefreshRequest: Encodable {
    let refreshToken: String
}

private struct TokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}
