import Foundation

/// Llama a los endpoints públicos de auth del user-service (`/register`, `/login`, `/refresh`,
/// `/logout`) a través del `APIClient`. Sin lógica de sesión: eso pertenece al repositorio.
struct AuthRemoteDataSource {
    private let client: APIClient
    private let encoder: JSONEncoder

    init(client: APIClient) {
        self.client = client
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func register(email: String, password: String, name: String) async throws -> AuthResponseDTO {
        let body = try encoder.encode(RegisterRequestDTO(email: email, password: password, name: name))
        return try await client.send(Endpoint(path: "register", method: .post, body: body, requiresAuth: false))
    }

    func login(email: String, password: String) async throws -> AuthResponseDTO {
        let body = try encoder.encode(LoginRequestDTO(email: email, password: password))
        return try await client.send(Endpoint(path: "login", method: .post, body: body, requiresAuth: false))
    }

    func signInWithApple(identityToken: String, name: String?) async throws -> AuthResponseDTO {
        let body = try encoder.encode(AppleSignInRequestDTO(identityToken: identityToken, name: name))
        return try await client.send(Endpoint(path: "apple", method: .post, body: body, requiresAuth: false))
    }

    func signInWithGoogle(idToken: String, name: String?) async throws -> AuthResponseDTO {
        let body = try encoder.encode(GoogleSignInRequestDTO(idToken: idToken, name: name))
        return try await client.send(Endpoint(path: "google", method: .post, body: body, requiresAuth: false))
    }

    func refresh(refreshToken: String) async throws -> RefreshResponseDTO {
        let body = try encoder.encode(SessionTokenRequestDTO(refreshToken: refreshToken))
        return try await client.send(Endpoint(path: "refresh", method: .post, body: body, requiresAuth: false))
    }

    func logout(refreshToken: String) async throws {
        let body = try encoder.encode(SessionTokenRequestDTO(refreshToken: refreshToken))
        try await client.send(Endpoint(path: "logout", method: .post, body: body, requiresAuth: false))
    }
}
