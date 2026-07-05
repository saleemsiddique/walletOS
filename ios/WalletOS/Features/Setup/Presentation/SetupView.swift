import SwiftUI

/// Onboarding post-registro (pantalla 04), estilo "Ledger": un paso por pantalla, una acción
/// primaria y el número protagonista (el balance) en el segundo paso.
struct SetupView: View {
    @StateObject private var viewModel: SetupViewModel

    init(viewModel: @autoclosure @escaping () -> SetupViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                header
                switch viewModel.step {
                case .bank:
                    bankStep
                case .wallet:
                    walletStep
                }
                if case .error(let message) = viewModel.status {
                    errorLabel(message)
                }
                primaryAction
                if viewModel.step == .wallet {
                    backButton
                }
            }
            .padding(Spacing.screenMargin)
            .animation(Motion.standard, value: viewModel.step)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AppColor.bg)
        .tint(AppColor.accent)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text(viewModel.step == .bank ? "PASO 1 DE 2" : "PASO 2 DE 2")
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.inkSoft)
            Text(viewModel.step == .bank ? "Tu banco" : "Tu primer wallet")
                .font(Typography.title)
                .foregroundStyle(AppColor.ink)
        }
        .padding(.top, Spacing.xxl)
    }

    private var bankStep: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            TextField("Nombre del banco", text: $viewModel.bankName)
                .textInputAutocapitalization(.words)
                .modifier(AuthFieldStyle())
            if !viewModel.bankSuggestions.isEmpty {
                bankSuggestionsList
            }
            fieldLabel("COLOR")
            AccountColorPicker(selectedHex: $viewModel.bankColor)
        }
    }

    private var bankSuggestionsList: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.bankSuggestions) { entry in
                Button {
                    viewModel.selectBank(entry)
                } label: {
                    HStack(spacing: Spacing.sm) {
                        BankLogoView(name: entry.displayName, colorHex: entry.brandColorHex, assetName: entry.assetName)
                        Text(entry.displayName)
                            .font(Typography.body)
                            .foregroundStyle(AppColor.ink)
                        Spacer()
                    }
                    .padding(.vertical, Spacing.xs)
                }
                if entry.id != viewModel.bankSuggestions.last?.id {
                    Rectangle()
                        .fill(AppColor.hairline)
                        .frame(height: 0.5)
                }
            }
        }
    }

    private var walletStep: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            fieldLabel("BALANCE ACTUAL")
            BalanceField(amount: $viewModel.initialBalance)
            TextField("Nombre del wallet", text: $viewModel.walletName)
                .textInputAutocapitalization(.words)
                .modifier(AuthFieldStyle())
            fieldLabel("COLOR")
            AccountColorPicker(selectedHex: $viewModel.walletColor)
        }
    }

    private var primaryAction: some View {
        ZStack {
            switch viewModel.step {
            case .bank:
                PrimaryButton(title: "Siguiente") {
                    viewModel.continueToWallet()
                }
                .disabled(!viewModel.canContinueFromBank)
                .opacity(viewModel.canContinueFromBank ? 1 : 0.4)
            case .wallet:
                PrimaryButton(title: "Empezar") {
                    Task { await viewModel.finish() }
                }
                .disabled(!viewModel.canFinish)
                .opacity(viewModel.canFinish ? 1 : 0.4)
                if viewModel.status == .saving {
                    ProgressView()
                        .tint(AppColor.onAccent)
                }
            }
        }
    }

    private var backButton: some View {
        Button("Atrás") {
            viewModel.backToBank()
        }
        .font(Typography.caption)
        .foregroundStyle(AppColor.accent)
        .frame(maxWidth: .infinity, alignment: .center)
        .disabled(viewModel.status == .saving)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(Typography.caption)
            .kerning(0.8)
            .foregroundStyle(AppColor.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func errorLabel(_ message: String) -> some View {
        Text(message)
            .font(Typography.body)
            .foregroundStyle(AppColor.expense)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    SetupView(
        viewModel: SetupViewModel(
            createBank: CreateBank(repository: PreviewAccountsRepository()),
            createWallet: CreateWallet(repository: PreviewAccountsRepository()),
            updateProfileTimezone: UpdateProfileTimezone(repository: PreviewProfileRepository()),
            onFinished: {}
        ))
}

private struct PreviewAccountsRepository: BankRepository, WalletRepository {
    func fetchBanks() async throws -> [Bank] { [] }
    func createBank(name: String, icon: String?, color: String) async throws -> Bank {
        Bank(id: "bank", name: name, icon: icon ?? "🏦", color: color, wallets: [], totalBalance: 0)
    }

    func createWallet(
        bankID: String,
        name: String,
        initialBalance: Decimal,
        color: String
    ) async throws -> Wallet {
        Wallet(id: "wallet", bankID: bankID, name: name, icon: "💳", color: color, balance: initialBalance)
    }

    func fetchWallets() async throws -> [WalletSummary] { [] }
}

private struct PreviewProfileRepository: ProfileRepository {
    func updateTimezone(_ identifier: String) async throws {}
}
