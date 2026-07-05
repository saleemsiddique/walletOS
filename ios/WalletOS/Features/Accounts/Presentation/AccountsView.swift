import SwiftUI

/// "Ver todas" desde Patrimonio (antes tab Cuentas — ver `docs/user-flow-and-bdd.md` §Navegación).
/// Agrupado por banco, con el total por banco y archivado por long-press (menú contextual, el gesto
/// nativo que el design-system §7.1 reserva para lo secundario; el swipe requeriría un `List` y
/// rompería el estilo plano con hairlines). Crear/editar banco y wallet llegan en las Ramas 19-20.
struct AccountsView: View {
    @StateObject private var viewModel: AccountsViewModel

    init(viewModel: @autoclosure @escaping () -> AccountsViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                switch viewModel.state {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity).padding(.top, Spacing.xxl)
                case .loaded(let banks):
                    ForEach(banks) { bank in
                        bankSection(bank)
                    }
                case .failed:
                    Text("No pudimos cargar tus cuentas.")
                        .font(Typography.body)
                        .foregroundStyle(AppColor.inkSoft)
                }
            }
            .padding(Spacing.screenMargin)
        }
        .background(AppColor.bg)
        .navigationTitle("Mis cuentas")
        .task { await viewModel.load() }
    }

    private func bankSection(_ bank: Bank) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text(bank.name.uppercased())
                    .font(Typography.caption)
                    .kerning(0.8)
                    .foregroundStyle(AppColor.inkSoft)
                Spacer()
                Text(CurrencyFormatter.eur(bank.totalBalance))
                    .font(Typography.caption)
                    .foregroundStyle(AppColor.inkSoft)
            }
            .contentShape(Rectangle())
            .contextMenu {
                Button("Archivar banco", role: .destructive) {
                    Task { await viewModel.archive(bankId: bank.id) }
                }
            }
            VStack(spacing: 0) {
                ForEach(bank.wallets) { wallet in
                    walletRow(wallet)
                    if wallet.id != bank.wallets.last?.id {
                        Rectangle().fill(AppColor.hairline).frame(height: 0.5)
                    }
                }
            }
        }
    }

    private func walletRow(_ wallet: Wallet) -> some View {
        HStack {
            Text(wallet.name)
                .font(Typography.body)
                .foregroundStyle(AppColor.ink)
            Spacer()
            Text(CurrencyFormatter.eur(wallet.balance))
                .font(Typography.amount)
                .foregroundStyle(AppColor.ink)
        }
        .padding(.vertical, Spacing.xs)
        .contentShape(Rectangle())
        .contextMenu {
            Button("Archivar wallet", role: .destructive) {
                Task { await viewModel.archive(walletId: wallet.id) }
            }
        }
    }
}
