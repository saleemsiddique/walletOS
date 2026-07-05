import Foundation

/// Validación local de forma de email (la validación real la hace el backend).
enum EmailFormat {
    static func isValid(_ email: String) -> Bool {
        email.range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil
    }
}
