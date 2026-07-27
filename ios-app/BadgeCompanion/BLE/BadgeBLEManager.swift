import Foundation
import CoreBluetooth
import Combine

/// GATT contract — keep in sync with the ESP32-S3 firmware.
enum BadgeGATT {
    static let service = CBUUID(string: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
    static let faceSelect = CBUUID(string: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
    static let imageData = CBUUID(string: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E")
    static let brightness = CBUUID(string: "6E400004-B5A3-F393-E0A9-E50E24DCCA9E")
    static let bootAnimFlag = CBUUID(string: "6E400005-B5A3-F393-E0A9-E50E24DCCA9E")
    static let status = CBUUID(string: "6E400006-B5A3-F393-E0A9-E50E24DCCA9E")

    static let allCharacteristics: [CBUUID] = [faceSelect, imageData, brightness, bootAnimFlag, status]
}

/// image_data packet header: frame index (1B) + total chunks (2B) + chunk index (2B)
enum ImageHeader {
    static let byteCount = 5
}

/// Real CoreBluetooth-backed implementation of `BLEManaging`.
/// MVVM: this is the "Model"/service layer — SwiftUI views bind to its
/// `@Published` properties via `.environmentObject`, never touching
/// CoreBluetooth types directly.
final class BadgeBLEManager: NSObject, ObservableObject, BLEManaging {

    // MARK: Published UI state

    @Published private(set) var state: ConnectionState = .idle
    @Published private(set) var discovered: [DiscoveredBadge] = []
    @Published private(set) var connectedName: String?
    @Published private(set) var brightness: Double = 0
    @Published private(set) var transfer: TransferPhase = .idle

    var statePublisher: AnyPublisher<ConnectionState, Never> { $state.eraseToAnyPublisher() }

    // MARK: CoreBluetooth

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var characteristics: [CBUUID: CBCharacteristic] = [:]

    private static let restoreID = "e36.badge.centralRestoreID"
    private static let lastPeripheralKey = "e36.badge.lastPeripheralUUID"

    // MARK: Brightness debounce (Combine)

    private let brightnessSubject = PassthroughSubject<UInt8, Never>()
    private var cancellables = Set<AnyCancellable>()

    // MARK: Image transfer state

    private var pendingChunks: [Data] = []
    private var currentFrameIndex: UInt8 = 0
    private var currentTotalFrames: Int = 1
    private var currentTotalChunks: Int = 0
    private var transferCompletion: ((Bool) -> Void)?

    override init() {
        super.init()
        central = CBCentralManager(
            delegate: self,
            queue: .main,
            options: [CBCentralManagerOptionRestoreIdentifierKey: Self.restoreID]
        )
        bindBrightnessDebounce()
    }

    // MARK: BLEManaging

    func start() {
        switch central.state {
        case .poweredOff: state = .poweredOff
        case .unauthorized: state = .unauthorized
        case .poweredOn: attemptAutoReconnectOrScan()
        default: state = .idle
        }
    }

    private func attemptAutoReconnectOrScan() {
        if let uuidString = UserDefaults.standard.string(forKey: Self.lastPeripheralKey),
           let uuid = UUID(uuidString: uuidString) {
            let known = central.retrievePeripherals(withIdentifiers: [uuid])
            if let match = known.first {
                connectToPeripheral(match)
                return
            }
        }
        scan()
    }

    func scan() {
        guard central.state == .poweredOn else { return }
        state = .scanning
        discovered = []
        central.scanForPeripherals(withServices: [BadgeGATT.service], options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ])
    }

    func connect(to badge: DiscoveredBadge) {
        guard let match = central.retrievePeripherals(withIdentifiers: [badge.id]).first
                ?? discoveredPeripherals[badge.id] else { return }
        connectToPeripheral(match)
    }

    private var discoveredPeripherals: [UUID: CBPeripheral] = [:]

    private func connectToPeripheral(_ p: CBPeripheral) {
        central.stopScan()
        peripheral = p
        p.delegate = self
        state = .connecting
        UserDefaults.standard.set(p.identifier.uuidString, forKey: Self.lastPeripheralKey)
        central.connect(p, options: nil)
    }

    func disconnect() {
        if let peripheral { central.cancelPeripheralConnection(peripheral) }
    }

    func selectFace(index: UInt8) {
        write(Data([index]), to: BadgeGATT.faceSelect, type: .withResponse)
    }

    func setBrightness(percent: Double) {
        brightness = percent
        brightnessSubject.send(UInt8((percent / 100.0) * 255.0))
    }

    private func bindBrightnessDebounce() {
        brightnessSubject
            // Caps writes at ~10/sec regardless of how fast the user drags the slider.
            .debounce(for: .milliseconds(100), scheduler: DispatchQueue.main)
            .removeDuplicates()
            .sink { [weak self] value in
                self?.write(Data([value]), to: BadgeGATT.brightness, type: .withResponse)
            }
            .store(in: &cancellables)
    }

    func setBootAnimationEnabled(_ enabled: Bool) {
        write(Data([enabled ? 1 : 0]), to: BadgeGATT.bootAnimFlag, type: .withResponse)
    }

    func sendImage(_ buffer: [UInt8], frameIndex: UInt8, totalFrames: Int, completion: @escaping (Bool) -> Void) {
        guard let peripheral, let ch = characteristics[BadgeGATT.imageData] else {
            completion(false)
            return
        }
        transferCompletion = completion
        currentFrameIndex = frameIndex
        currentTotalFrames = totalFrames

        // Never hardcode the MTU — it's negotiated per-connection.
        let mtu = peripheral.maximumWriteValueLength(for: .withoutResponse)
        let payloadSize = max(20, mtu - ImageHeader.byteCount)
        let totalChunks = Int(ceil(Double(buffer.count) / Double(payloadSize)))
        currentTotalChunks = totalChunks

        pendingChunks = stride(from: 0, to: buffer.count, by: payloadSize).enumerated().map { idx, offset in
            let end = min(offset + payloadSize, buffer.count)
            var packet = Data()
            packet.append(frameIndex)
            packet.append(contentsOf: UInt16(totalChunks).bigEndianBytes)
            packet.append(contentsOf: UInt16(idx).bigEndianBytes)
            packet.append(contentsOf: buffer[offset..<end])
            return packet
        }

        transfer = .uploading(chunk: 0, of: totalChunks, frame: Int(frameIndex), totalFrames: totalFrames)
        sendNextChunk(via: ch)
    }

    private func sendNextChunk(via characteristic: CBCharacteristic) {
        guard let peripheral else { return }
        guard let packet = pendingChunks.first else {
            transfer = .complete
            transferCompletion?(true)
            transferCompletion = nil
            return
        }
        peripheral.writeValue(packet, for: characteristic, type: .withoutResponse)
        // Real hardware ACKs by notifying `status`; peripheral(_:didUpdateValueFor:)
        // below advances the queue. If disconnected mid-transfer, `pendingChunks`
        // is left intact so a fresh connection can resume from here.
    }

    private func write(_ data: Data, to uuid: CBUUID, type: CBCharacteristicWriteType) {
        guard let peripheral, let ch = characteristics[uuid] else { return }
        peripheral.writeValue(data, for: ch, type: type)
    }
}

// MARK: - CBCentralManagerDelegate

extension BadgeBLEManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn: attemptAutoReconnectOrScan()
        case .poweredOff: state = .poweredOff
        case .unauthorized: state = .unauthorized
        default: state = .idle
        }
    }

    func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        // State restoration for background BLE (bluetooth-central background mode).
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral],
           let restored = peripherals.first {
            peripheral = restored
            restored.delegate = self
            if restored.state == .connected {
                state = .discoveringServices
                restored.discoverServices([BadgeGATT.service])
            }
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                         advertisementData: [String: Any], rssi RSSI: NSNumber) {
        discoveredPeripherals[peripheral.identifier] = peripheral
        let badge = DiscoveredBadge(
            id: peripheral.identifier,
            name: peripheral.name ?? "E36 Badge",
            rssi: RSSI.intValue
        )
        if !discovered.contains(where: { $0.id == badge.id }) {
            discovered.append(badge)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        state = .discoveringServices
        connectedName = peripheral.name
        peripheral.discoverServices([BadgeGATT.service])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        state = .disconnected(reason: error?.localizedDescription)
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        state = .disconnected(reason: error?.localizedDescription)
        connectedName = nil
        characteristics.removeAll()
        // Mid-transfer disconnects leave `pendingChunks` populated so the next
        // successful connect + sendImage(resume:) can pick up where it left off.
    }
}

// MARK: - CBPeripheralDelegate

extension BadgeBLEManager: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for service in services where service.uuid == BadgeGATT.service {
            peripheral.discoverCharacteristics(BadgeGATT.allCharacteristics, for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics else { return }
        for c in chars {
            characteristics[c.uuid] = c
            if c.uuid == BadgeGATT.status, c.properties.contains(.notify) {
                peripheral.setNotifyValue(true, for: c)
            }
            if c.uuid == BadgeGATT.brightness, c.properties.contains(.read) {
                peripheral.readValue(for: c)
            }
        }
        state = .ready
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let data = characteristic.value else { return }

        if characteristic.uuid == BadgeGATT.brightness, let byte = data.first {
            brightness = (Double(byte) / 255.0) * 100.0
        }

        if characteristic.uuid == BadgeGATT.status, let code = data.first {
            handleStatusNotification(code: code)
        }
    }

    /// status byte contract: 0x00 = ACK chunk, 0x01 = frame complete, 0xFF = error/NACK.
    private func handleStatusNotification(code: UInt8) {
        switch code {
        case 0x00:
            guard !pendingChunks.isEmpty, let ch = characteristics[BadgeGATT.imageData] else { return }
            pendingChunks.removeFirst()
            let sent = currentTotalChunks - pendingChunks.count
            transfer = .uploading(chunk: sent, of: currentTotalChunks, frame: Int(currentFrameIndex), totalFrames: currentTotalFrames)
            sendNextChunk(via: ch)
        case 0x01:
            transfer = .complete
            transferCompletion?(true)
            transferCompletion = nil
        default:
            transfer = .failed("Badge returned error code \(code)")
            transferCompletion?(false)
            transferCompletion = nil
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error {
            transfer = .failed(error.localizedDescription)
        }
    }
}

// MARK: - Helpers

private extension UInt16 {
    var bigEndianBytes: [UInt8] { [UInt8(self >> 8), UInt8(self & 0xFF)] }
}
