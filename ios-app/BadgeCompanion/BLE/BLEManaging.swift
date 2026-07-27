import Foundation
import Combine

/// Connection lifecycle for the badge peripheral.
enum ConnectionState: Equatable {
    case poweredOff
    case unauthorized
    case idle
    case scanning
    case connecting
    case discoveringServices
    case ready
    case disconnected(reason: String?)
}

enum TransferPhase: Equatable {
    case idle
    case preparing
    case converting
    case uploading(chunk: Int, of: Int, frame: Int, totalFrames: Int)
    case complete
    case failed(String)
}

struct DiscoveredBadge: Identifiable, Equatable {
    let id: UUID
    let name: String
    let rssi: Int
}

/// Shared contract implemented by both `BadgeBLEManager` (real CoreBluetooth)
/// and `MockBLEManager` (simulator harness) so SwiftUI views never need to
/// know which one they're bound to. Inject whichever conforms via
/// `.environmentObject`.
protocol BLEManaging: ObservableObject {
    var state: ConnectionState { get }
    var discovered: [DiscoveredBadge] { get }
    var connectedName: String? { get }
    var brightness: Double { get }
    var transfer: TransferPhase { get }
    var statePublisher: AnyPublisher<ConnectionState, Never> { get }

    func start()
    func scan()
    func connect(to badge: DiscoveredBadge)
    func disconnect()

    func selectFace(index: UInt8)
    func setBrightness(percent: Double)
    func setBootAnimationEnabled(_ enabled: Bool)
    func sendImage(_ buffer: [UInt8], frameIndex: UInt8, totalFrames: Int, completion: @escaping (Bool) -> Void)
}
