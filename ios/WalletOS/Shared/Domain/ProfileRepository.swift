import Foundation

/// Acceso al perfil del usuario (user-service). En Setup solo se ajusta la zona horaria; el resto
/// de campos de `PATCH /me` los cubrirá Ajustes en su rama.
protocol ProfileRepository {
    /// `PATCH /me { timezone }` — fija la zona horaria del usuario para que los recordatorios que
    /// envía el backend caigan a la hora local correcta.
    func updateTimezone(_ identifier: String) async throws
}
