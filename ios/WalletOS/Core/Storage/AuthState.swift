import SwiftUI

/// Estado de sesión observable por la UI raíz para decidir entre el flujo de auth y la app.
@MainActor
final class AuthState: ObservableObject {
    enum Status: Equatable {
        case signedIn
        case signedOut
    }

    @Published private(set) var status: Status = .signedOut

    func update(to status: Status) {
        self.status = status
    }
}
