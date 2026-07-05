import Foundation

/// Cuerpo de `PATCH /me`. En Setup solo viaja `timezone`; los demás campos del contrato se añadirán
/// cuando Ajustes los necesite (las claves ausentes no se envían).
struct UpdateProfileRequestDTO: Encodable {
    let timezone: String
}
