import Foundation

/// Estado y orquestación del onboarding post-registro (wizard de 2 pasos: banco → primer wallet).
/// El éxito no navega desde aquí: invoca `onFinished`, y el router raíz pasa a Home.
@MainActor
final class SetupViewModel: ObservableObject {
    enum Step: Equatable {
        case bank
        case wallet
    }

    enum Status: Equatable {
        case idle
        case saving
        case error(String)
    }

    @Published var step: Step = .bank
    @Published var bankName = "" {
        didSet {
            // Solo se limpia si el cambio vino de teclear, no de aceptar una sugerencia (que fija
            // `bankName` y `selectedBankCatalogKey` juntos en `selectBank`).
            guard !isApplyingBankSuggestion else { return }
            selectedBankCatalogKey = nil
        }
    }
    @Published private(set) var selectedBankCatalogKey: String?
    @Published var bankColor = AccountColorPicker.defaultHex
    @Published var walletName = ""
    @Published var initialBalance: Decimal = 0
    @Published var walletColor = AccountColorPicker.defaultHex
    @Published private(set) var status: Status = .idle

    private var isApplyingBankSuggestion = false

    private let createBank: CreateBank
    private let createWallet: CreateWallet
    private let updateProfileTimezone: UpdateProfileTimezone
    private let currentTimezone: () -> String
    private let onFinished: () -> Void
    /// Banco ya creado en un intento previo: evita duplicarlo si el wallet falló y se reintenta.
    private var createdBank: Bank?

    init(
        createBank: CreateBank,
        createWallet: CreateWallet,
        updateProfileTimezone: UpdateProfileTimezone,
        currentTimezone: @escaping () -> String = { TimeZone.current.identifier },
        onFinished: @escaping () -> Void
    ) {
        self.createBank = createBank
        self.createWallet = createWallet
        self.updateProfileTimezone = updateProfileTimezone
        self.currentTimezone = currentTimezone
        self.onFinished = onFinished
    }

    /// Coincidencias del catálogo mientras el usuario escribe; vacío una vez aceptó una sugerencia
    /// o si el nombre está vacío.
    var bankSuggestions: [BankCatalogEntry] {
        guard selectedBankCatalogKey == nil else { return [] }
        return BankCatalog.search(bankName)
    }

    func selectBank(_ entry: BankCatalogEntry) {
        isApplyingBankSuggestion = true
        bankName = entry.displayName
        selectedBankCatalogKey = entry.key
        isApplyingBankSuggestion = false
    }

    var canContinueFromBank: Bool {
        !bankName.trimmed.isEmpty
    }

    var canFinish: Bool {
        status != .saving && !walletName.trimmed.isEmpty
    }

    func continueToWallet() {
        guard canContinueFromBank else { return }
        status = .idle
        step = .wallet
    }

    func backToBank() {
        step = .bank
    }

    func finish() async {
        guard canFinish else { return }
        status = .saving

        // La zona horaria es mejor-esfuerzo: mejora los recordatorios, pero un fallo aquí no debe
        // impedir crear el banco y el wallet.
        try? await updateProfileTimezone.execute(currentTimezone())

        do {
            let bank = try await bankForThisAttempt()
            _ = try await createWallet.execute(
                bankID: bank.id,
                name: walletName.trimmed,
                initialBalance: initialBalance,
                color: walletColor
            )
            Haptics.success()
            onFinished()
        } catch {
            status = .error(Self.message(for: error))
        }
    }

    /// Reutiliza el banco de un intento anterior si existe; si no, lo crea y lo memoriza.
    private func bankForThisAttempt() async throws -> Bank {
        if let createdBank {
            return createdBank
        }
        let bank = try await createBank.execute(
            name: bankName.trimmed,
            icon: selectedBankCatalogKey,
            color: bankColor
        )
        createdBank = bank
        return bank
    }

    private static func message(for error: Error) -> String {
        switch error {
        case APIError.offline:
            return "Sin conexión. Inténtalo cuando vuelvas a tener red."
        case APIError.rateLimited:
            return "Demasiados intentos. Espera un momento y vuelve a intentarlo."
        default:
            return "No se pudo completar la configuración. Inténtalo de nuevo."
        }
    }
}

extension String {
    fileprivate var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
