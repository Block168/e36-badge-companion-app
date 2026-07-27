import SwiftUI

/// Root view — a persistent connection-status pill is always visible at the
/// top regardless of which tab is active, per the UX priority that connection
/// state should never be ambiguous while a BLE transfer might be in flight.
struct ContentView<Manager: BLEManaging>: View {
    @EnvironmentObject var ble: Manager
    @State private var selectedTab: Tab = .connect

    enum Tab { case connect, faces, brightness, boot }

    var body: some View {
        VStack(spacing: 0) {
            StatusPillView(state: ble.state, connectedName: ble.connectedName)
                .padding(.top, 8)
                .padding(.bottom, 4)

            TabView(selection: $selectedTab) {
                ConnectionView<Manager>()
                    .tabItem { Label("Connect", systemImage: "dot.radiowaves.left.and.right") }
                    .tag(Tab.connect)

                FaceGalleryView<Manager>()
                    .tabItem { Label("Faces", systemImage: "circle.grid.2x2") }
                    .tag(Tab.faces)

                BrightnessView<Manager>()
                    .tabItem { Label("Brightness", systemImage: "sun.max") }
                    .tag(Tab.brightness)

                BootAnimationView<Manager>()
                    .tabItem { Label("Boot", systemImage: "wand.and.stars") }
                    .tag(Tab.boot)
            }
        }
        .onAppear { ble.start() }
    }
}

struct StatusPillView: View {
    let state: ConnectionState
    let connectedName: String?

    private var label: String {
        switch state {
        case .poweredOff: return "Bluetooth Off"
        case .unauthorized: return "Not Authorized"
        case .idle: return "Not Connected"
        case .scanning: return "Scanning…"
        case .connecting: return "Connecting…"
        case .discoveringServices: return "Discovering…"
        case .ready: return connectedName.map { "Connected · \($0)" } ?? "Connected"
        case .disconnected: return "Disconnected"
        }
    }

    private var tint: Color {
        switch state {
        case .ready: return .green
        case .poweredOff, .unauthorized, .disconnected: return .red
        case .scanning, .connecting, .discoveringServices: return .orange
        case .idle: return .gray
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(tint).frame(width: 8, height: 8)
            Text(label).font(.caption).fontWeight(.medium)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(tint.opacity(0.15), in: Capsule())
    }
}

/// Minimal connect screen — full scanning list lives here in production.
struct ConnectionView<Manager: BLEManaging>: View {
    @EnvironmentObject var ble: Manager

    var body: some View {
        VStack(spacing: 16) {
            if case .ready = ble.state {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 48)).foregroundStyle(.green)
                Text(ble.connectedName ?? "Badge").font(.headline)
                Button("Disconnect", role: .destructive) { ble.disconnect() }
            } else {
                List(ble.discovered) { badge in
                    Button {
                        ble.connect(to: badge)
                    } label: {
                        HStack {
                            Text(badge.name)
                            Spacer()
                            Text("\(badge.rssi) dBm").foregroundStyle(.secondary)
                        }
                    }
                }
                Button("Scan for Badge") { ble.scan() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }
}
