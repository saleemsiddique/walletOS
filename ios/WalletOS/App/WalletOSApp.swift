import SwiftUI

@main
struct WalletOSApp: App {
    private let dependencies: AppDependencies

    init() {
        dependencies = AppDependencies()
    }

    var body: some Scene {
        WindowGroup {
            RootView(dependencies: dependencies)
                .task { await dependencies.tokenStore.restoreSession() }
        }
    }
}
