import SwiftUI

/// "Ver todas" desde Patrimonio (antes tab Cuentas — ver `docs/user-flow-and-bdd.md` §Navegación).
/// Agrupado por banco; crear/editar/archivar llega en las Ramas 18-20.
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
            Text(bank.name.uppercased())
                .font(Typography.caption)
                .kerning(0.8)
                .foregroundStyle(AppColor.inkSoft)
            VStack(spacing: 0) {
                ForEach(bank.wallets) { wallet in
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
                    if wallet.id != bank.wallets.last?.id {
                        Rectangle().fill(AppColor.hairline).frame(height: 0.5)
                    }
                }
            }
        }
    }
}
