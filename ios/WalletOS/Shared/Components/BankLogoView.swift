import SwiftUI
import UIKit

/// Identidad visual de un banco: el logo real si su asset ya existe en `Assets.xcassets`, o un
/// monograma con la inicial del nombre mientras no lo tenga (ver nota de `BankCatalog`).
struct BankLogoView: View {
    let name: String
    let colorHex: String
    /// Asset con el logo real, si el banco pertenece al catálogo (`BankCatalogEntry.assetName`).
    var assetName: String?

    var body: some View {
        Group {
            if let assetName, UIImage(named: assetName) != nil {
                Image(assetName)
                    .resizable()
                    .scaledToFit()
                    .clipShape(Circle())
            } else {
                monogram
            }
        }
        .frame(width: 40, height: 40)
        .accessibilityLabel(name)
    }

    private var monogram: some View {
        Circle()
            .fill(Color(hex: colorHex))
            .overlay {
                Text(initial)
                    .font(.system(.body, design: .monospaced).weight(.semibold))
                    .foregroundStyle(.white)
            }
    }

    private var initial: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).first.map(String.init)?.uppercased() ?? "?"
    }
}

#Preview {
    VStack(spacing: Spacing.md) {
        BankLogoView(name: "Santander", colorHex: "#EC0000", assetName: "bank-logo-santander")
        BankLogoView(name: "Mi Banco Local", colorHex: "#007AFF", assetName: nil)
    }
    .padding(Spacing.screenMargin)
    .background(AppColor.bg)
}
