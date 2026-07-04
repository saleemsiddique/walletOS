import GoogleSignIn
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
                .onOpenURL { url in
                    // Callback del OAuth de Google; el resto de esquemas son deep links propios.
                    _ = GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
