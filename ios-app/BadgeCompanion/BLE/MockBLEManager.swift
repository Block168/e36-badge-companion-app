import Foundation
import Combine

/// Development harness conforming to `BLEManaging` so every SwiftUI view can
/// run in the iOS Simulator (where CoreBluetooth's central role is
/// unavailable) before physical badge hardware exists. Swap this in for
/// `BadgeBLEManager` at the injection site in `BadgeCompanionApp.swift`.
final class MockBLEManager: NSObject, ObservableObject, BLEManaging {
    @Published private(set) var state: ConnectionState = .idle
    @Published private(set) var discovered: [DiscoveredBadge] = []
    @Published private(set) var connectedName: String?
    @Published private(set) var brightness: Double = 70
    @Published private(set) var transfer: TransferPhase = .idle

    var statePublisher: AnyPublisher<ConnectionState, Never> { $state.eraseToAnyPublisher() }

    private let fakeBadge = DiscoveredBadge(id: UUID(), name: "E36-Badge-A1B2 (mock)", rssi: -54)

    func start() { state = .idle }

    func scan() {
        state = .scanning
        discovered = []
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.discovered = [self?.fakeBadge].compactMap { $0 }
        }
    }

    func connect(to badge: DiscoveredBadge) {
        state = .connecting
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            self?.state = .discoveringServices
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self?.state = .ready
                self?.connectedName = badge.name
            }
        }
    }

    func disconnect() {
        state = .disconnected(reason: nil)
        connectedName = nil
    }

    func selectFace(index: UInt8) {
        print("[mock] face_select <- \(index)")
    }

    func setBrightness(percent: Double) {
        brightness = percent
        print("[mock] brightness <- \(UInt8((percent / 100) * 255))")
    }

    func setBootAnimationEnabled(_ enabled: Bool) {
        print("[mock] boot_anim_flag <- \(enabled)")
    }

    func sendImage(_ buffer: [UInt8], frameIndex: UInt8, totalFrames: Int, completion: @escaping (Bool) -> Void) {
        let payloadSize = 180
        let totalChunks = max(1, Int(ceil(Double(buffer.count) / Double(payloadSize))))
        var sent = 0
        transfer = .uploading(chunk: 0, of: totalChunks, frame: Int(frameIndex), totalFrames: totalFrames)

        Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] timer in
            sent += max(1, totalChunks / 25)
            sent = min(sent, totalChunks)
            self?.transfer = .uploading(chunk: sent, of: totalChunks, frame: Int(frameIndex), totalFrames: totalFrames)
            if sent >= totalChunks {
                timer.invalidate()
                self?.transfer = .complete
                completion(true)
            }
        }
    }
}
