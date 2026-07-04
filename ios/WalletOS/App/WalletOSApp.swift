import GoogleSignIn
import SwiftUI

@main
struct WalletOSApp: App {
    private let dependencies: AppDependencies
    @State private var deepLink: DeepLink?

    init() {
        dependencies = AppDependencies()
    }

    var body: some Scene {
        WindowGroup {
            RootView(dependencies: dependencies, deepLink: $deepLink)
                .task { await dependencies.tokenStore.restoreSession() }
                .onOpenURL { url in
                    // Primero el callback del OAuth de Google; el resto, deep links propios.
                    if GIDSignIn.sharedInstance.handle(url) { return }
                    deepLink = DeepLinkRouter.deepLink(from: url)
                }
        }
    }
}
