import Foundation

/// Decide, ya con sesión iniciada, a dónde va el usuario: si aún no tiene bancos, al setup inicial;
/// si ya los tiene, a Home. Consulta `GET /banks` (fuente de verdad, sin estado local que mantener).
@MainActor
final class AuthenticatedRouterViewModel: ObservableObject {
    enum Destination: Equatable {
        case loading
        case setup
        case home
        case failed
    }

    @Published private(set) var destination: Destination = .loading

    private let bankRepository: BankRepository

    init(bankRepository: BankRepository) {
        self.bankRepository = bankRepository
    }

    func decideDestination() async {
        destination = .loading
        do {
            let banks = try await bankRepository.fetchBanks()
            destination = banks.isEmpty ? .setup : .home
        } catch {
            // Sin datos no se puede decidir: nunca forzar setup (crearía cuentas duplicadas para un
            // usuario que ya las tiene). Se ofrece reintentar.
            destination = .failed
        }
    }

    func goHome() {
        destination = .home
    }
}
