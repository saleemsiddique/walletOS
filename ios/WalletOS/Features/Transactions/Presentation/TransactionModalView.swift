import SwiftUI

/// Modal de añadir transacción (Rama 16): toggle gasto/ingreso/transferencia, importe protagonista
/// en SF Mono, numpad, y —salvo en transferencia— nota con auto-categorización y grid de categorías.
struct TransactionModalView: View {
    @StateObject private var viewModel: TransactionModalViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: @autoclosure @escaping () -> TransactionModalViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    modePicker
                    amountDisplay
                    walletPickers
                    if viewModel.mode != .transfer {
                        noteField
                        categorySection
                    }
                    AmountKeypad(amount: $viewModel.amount)
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(Typography.body)
                            .foregroundStyle(AppColor.expense)
                    }
                    saveButton
                    if viewModel.isEditing {
                        deleteButton
                    }
                }
                .padding(Spacing.screenMargin)
            }
            .background(AppColor.bg)
            .tint(AppColor.accent)
            .navigationTitle(viewModel.isEditing ? "Editar transacción" : "Nueva transacción")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
            .task { await viewModel.load() }
        }
    }

    private var modePicker: some View {
        // Editar no permite convertir a transferencia (ni una transferencia a gasto): solo se
        // alterna gasto/ingreso. Al crear están los tres modos.
        Picker("Tipo", selection: $viewModel.mode) {
            ForEach(availableModes, id: \.self) { mode in
                Text(mode.title).tag(mode)
            }
        }
        .pickerStyle(.segmented)
    }

    private var availableModes: [TransactionMode] {
        viewModel.isEditing ? [.expense, .income] : TransactionMode.allCases
    }

    private var amountDisplay: some View {
        Text(CurrencyFormatter.eur(viewModel.amount))
            .font(Typography.hero)
            .foregroundStyle(AppColor.ink)
            .contentTransition(.numericText())
            .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var walletPickers: some View {
        if viewModel.mode == .transfer {
            walletPicker("DESDE", selection: $viewModel.selectedWalletId)
            walletPicker("HACIA", selection: $viewModel.destinationWalletId)
        } else {
            walletPicker("WALLET", selection: $viewModel.selectedWalletId)
        }
    }

    private func walletPicker(_ label: String, selection: Binding<String?>) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            fieldLabel(label)
            Picker(label, selection: selection) {
                Text("Elegir").tag(String?.none)
                ForEach(viewModel.wallets) { wallet in
                    Text("\(wallet.bankName) · \(wallet.name)").tag(String?.some(wallet.id))
                }
            }
            .pickerStyle(.menu)
            .tint(AppColor.accent)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            fieldLabel("NOTA")
            TextField("Opcional", text: $viewModel.note)
                .textInputAutocapitalization(.sentences)
                .modifier(AuthFieldStyle())
        }
    }

    @ViewBuilder
    private var categorySection: some View {
        if !viewModel.categories.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                fieldLabel("CATEGORÍA")
                CategoryGrid(categories: viewModel.categories, selectedId: $viewModel.selectedCategoryId)
            }
        }
    }

    private var saveButton: some View {
        ZStack {
            PrimaryButton(title: viewModel.mode == .transfer ? "Transferir" : "Guardar") {
                Task { await viewModel.save() }
            }
            .disabled(!viewModel.canSave)
            .opacity(viewModel.canSave ? 1 : 0.4)
            if viewModel.isSaving {
                ProgressView().tint(AppColor.onAccent)
            }
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            viewModel.requestDelete()
            dismiss()
        } label: {
            Text("Borrar")
                .font(Typography.headline)
                .foregroundStyle(AppColor.expense)
                .frame(maxWidth: .infinity, minHeight: PrimaryButton.minHeight)
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(Typography.caption)
            .kerning(0.8)
            .foregroundStyle(AppColor.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
