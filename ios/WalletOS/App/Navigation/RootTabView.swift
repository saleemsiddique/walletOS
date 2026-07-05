import SwiftUI

/// Tab bar raíz de la app autenticada (Rama 15): Patrimonio, Actividad, Insights, Ajustes —
/// sustituye a los 4 tabs pre-pivote (Home/Cuentas/Stats/Insights + Ajustes tras ⚙️, ver
/// `docs/user-flow-and-bdd.md` §Navegación). Actividad/Insights/Ajustes son placeholders hasta sus
/// propias ramas.
struct RootTabView: View {
    @StateObject private var router = AppRouter()
    private let dependencies: AppDependencies

    init(dependencies: AppDependencies) {
        self.dependencies = dependencies
    }

    var body: some View {
        TabView(selection: $router.selectedTab) {
            NavigationStack {
                HomeView(
                    viewModel: dependencies.makeHomeViewModel(),
                    makeAccountsViewModel: { dependencies.makeAccountsViewModel() },
                    makeTransactionModalViewModel: { onSaved in
                        dependencies.makeTransactionModalViewModel(onSaved: onSaved)
                    },
                    makeEditTransactionModalViewModel: { transactionId, onSaved, onDelete in
                        dependencies.makeEditTransactionModalViewModel(
                            transactionId: transactionId, onSaved: onSaved, onDelete: onDelete)
                    }
                )
            }
            .tabItem { Label("Patrimonio", systemImage: "banknote") }
            .tag(AppRouter.Tab.patrimonio)

            NavigationStack {
                ComingSoonView(symbol: "chart.bar", title: "Actividad", message: "Próximamente.")
            }
            .tabItem { Label("Actividad", systemImage: "chart.bar") }
            .tag(AppRouter.Tab.actividad)

            NavigationStack {
                ComingSoonView(symbol: "sparkles", title: "Insights", message: "Próximamente.")
            }
            .tabItem { Label("Insights", systemImage: "sparkles") }
            .tag(AppRouter.Tab.insights)

            NavigationStack {
                ComingSoonView(symbol: "gearshape", title: "Ajustes", message: "Próximamente.")
            }
            .tabItem { Label("Ajustes", systemImage: "gearshape") }
            .tag(AppRouter.Tab.ajustes)
        }
        .tint(AppColor.accent)
    }
}
