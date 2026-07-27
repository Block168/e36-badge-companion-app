import SwiftUI

@main
struct BadgeCompanionApp: App {
    // Swap `BadgeBLEManager()` for `MockBLEManager()` to run the full UI in
    // the iOS Simulator without physical hardware (CoreBluetooth's central
    // role is unavailable there).
    @StateObject private var ble = BadgeBLEManager()

    var body: some Scene {
        WindowGroup {
            ContentView<BadgeBLEManager>()
                .environmentObject(ble)
        }
    }
}
