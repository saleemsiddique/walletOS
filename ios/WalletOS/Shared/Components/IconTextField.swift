import SwiftUI

/// Campo de formulario con SF Symbol a la izquierda (01-auth.md): relleno `surface`, radio `md`
/// y borde que pasa de `separator` a `accent` con el foco. `isSecure` añade el ojo de
/// mostrar/ocultar sin perder el valor. Lo usan Auth, Forgot y Reset.
struct IconTextField<FocusValue: Hashable>: View {
    let symbolName: String
    let placeholder: String
    @Binding var text: String
    var isSecure = false

    let focus: FocusState<FocusValue?>.Binding
    let focusValue: FocusValue

    @State private var isRevealed = false

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: symbolName)
                .foregroundStyle(AppColor.textSecondary)
                .frame(width: 24)
            field
            if isSecure {
                revealButton
            }
        }
        .font(Typography.body)
        .padding(.horizontal, Spacing.md)
        .frame(minHeight: 54)
        .background(AppColor.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .strokeBorder(isFocused ? AppColor.accent : AppColor.separator, lineWidth: 1)
        }
        .animation(.easeInOut(duration: Motion.fast), value: isFocused)
    }

    private var isFocused: Bool {
        focus.wrappedValue == focusValue
    }

    @ViewBuilder private var field: some View {
        if isSecure, !isRevealed {
            SecureField(placeholder, text: $text)
                .focused(focus, equals: focusValue)
        } else {
            TextField(placeholder, text: $text)
                .focused(focus, equals: focusValue)
        }
    }

    private var revealButton: some View {
        Button {
            let wasFocused = isFocused
            isRevealed.toggle()
            if wasFocused {
                // Cambiar SecureField↔TextField desmonta el campo enfocado; se re-enfoca en el
                // siguiente ciclo, cuando la variante nueva ya está montada.
                DispatchQueue.main.async { focus.wrappedValue = focusValue }
            }
        } label: {
            Image(systemName: isRevealed ? "eye.slash" : "eye")
                .foregroundStyle(AppColor.textSecondary)
                .frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel(isRevealed ? "Ocultar contraseña" : "Mostrar contraseña")
    }
}

#Preview {
    struct PreviewHost: View {
        enum Field { case email, password }

        @State private var email = ""
        @State private var password = "12345678"
        @FocusState private var focusedField: Field?

        var body: some View {
            VStack(spacing: Spacing.sm) {
                IconTextField(
                    symbolName: "envelope", placeholder: "Email", text: $email,
                    focus: $focusedField, focusValue: Field.email
                )
                IconTextField(
                    symbolName: "lock", placeholder: "Contraseña", text: $password, isSecure: true,
                    focus: $focusedField, focusValue: Field.password
                )
            }
            .padding(Spacing.screenMargin)
            .background(AppColor.bg)
        }
    }
    return PreviewHost()
}
