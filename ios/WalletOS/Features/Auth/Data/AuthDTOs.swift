import Foundation

/// Respuesta de `POST /register` y `POST /login` (y de `/apple` y `/google` en las Ramas 10–11).
struct AuthResponseDTO: Decodable {
    let user: AuthUserDTO
    let accessToken: String
    let refreshToken: String
}

struct AuthUserDTO: Decodable {
    let id: String
    let email: String
    let name: String
}

/// Respuesta de `POST /refresh` (rota el par de tokens, sin usuario).
struct RefreshResponseDTO: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct RegisterRequestDTO: Encodable {
    let email: String
    let password: String
    let name: String
}

struct LoginRequestDTO: Encodable {
    let email: String
    let password: String
}

/// `name` va solo si Apple lo entrega (primera autorización); si es `nil` no se envía la clave.
struct AppleSignInRequestDTO: Encodable {
    let identityToken: String
    let name: String?
}

struct GoogleSignInRequestDTO: Encodable {
    let idToken: String
    let name: String?
}

struct ForgotPasswordRequestDTO: Encodable {
    let email: String
}

struct ResetPasswordRequestDTO: Encodable {
    let token: String
    let newPassword: String
}

/// Cuerpo común de `POST /refresh` y `POST /logout`.
struct SessionTokenRequestDTO: Encodable {
    let refreshToken: String
}
