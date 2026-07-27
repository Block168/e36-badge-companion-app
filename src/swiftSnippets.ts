// Short excerpts mirrored from the full source in /ios-app for in-app reference.
// Full, compilable files live in the ios-app/ directory of this repo.

export const SWIFT_SNIPPETS: { title: string; file: string; code: string }[] = [
  {
    title: "Connection State Machine",
    file: "ios-app/BadgeCompanion/BLE/BadgeBLEManager.swift",
    code: `enum ConnectionState: Equatable {
    case poweredOff, unauthorized, idle
    case scanning, connecting, discoveringServices
    case ready, disconnected
}

final class BadgeBLEManager: NSObject, ObservableObject, BLEManaging {
    @Published private(set) var state: ConnectionState = .idle
    @Published private(set) var brightness: Double = 0
    @Published private(set) var transfer: TransferProgress = .idle

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private let lastPeripheralKey = "e36.lastPeripheralUUID"

    override init() {
        super.init()
        central = CBCentralManager(
            delegate: self, queue: .main,
            options: [CBCentralManagerOptionRestoreIdentifierKey: "e36.badge.restoreID"]
        )
    }

    func start() {
        if let uuidString = UserDefaults.standard.string(forKey: lastPeripheralKey),
           let uuid = UUID(uuidString: uuidString) {
            let known = central.retrievePeripherals(withIdentifiers: [uuid])
            if let match = known.first {
                connect(to: match)
                return
            }
        }
        scan()
    }
}`,
  },
  {
    title: "Chunked Image Transfer (ACK-based)",
    file: "ios-app/BadgeCompanion/BLE/BadgeBLEManager.swift",
    code: `func sendImage(_ buffer: [UInt8], frameIndex: UInt8, totalFrames: Int) {
    guard let peripheral, let imageChar = characteristics[.imageData] else { return }
    let mtu = peripheral.maximumWriteValueLength(for: .withoutResponse)
    let payloadSize = mtu - ImageHeader.byteCount   // never hardcode MTU
    let totalChunks = Int(ceil(Double(buffer.count) / Double(payloadSize)))

    pendingChunks = stride(from: 0, to: buffer.count, by: payloadSize).enumerated().map {
        idx, offset in
        let end = min(offset + payloadSize, buffer.count)
        var packet = Data()
        packet.append(frameIndex)
        packet.append(UInt16(totalChunks).bigEndianBytes)
        packet.append(UInt16(idx).bigEndianBytes)
        packet.append(contentsOf: buffer[offset..<end])
        return packet
    }
    transfer = .uploading(chunk: 0, of: totalChunks, frame: Int(frameIndex), totalFrames: totalFrames)
    sendNextChunk()
}

// Called again from peripheral(_:didUpdateValueFor:) when the status characteristic notifies ACK/NACK.
private func sendNextChunk() {
    guard let packet = pendingChunks.first, let peripheral, let ch = characteristics[.imageData] else {
        transfer = .complete
        return
    }
    peripheral.writeValue(packet, for: ch, type: .withoutResponse)
}`,
  },
  {
    title: "Debounced Brightness (Combine)",
    file: "ios-app/BadgeCompanion/BLE/BadgeBLEManager.swift",
    code: `private let brightnessSubject = PassthroughSubject<UInt8, Never>()
private var cancellables = Set<AnyCancellable>()

private func bindBrightnessDebounce() {
    brightnessSubject
        .debounce(for: .milliseconds(100), scheduler: DispatchQueue.main) // caps ~10 writes/sec
        .removeDuplicates()
        .sink { [weak self] value in
            guard let self, let peripheral = self.peripheral,
                  let ch = self.characteristics[.brightness] else { return }
            peripheral.writeValue(Data([value]), for: ch, type: .withResponse)
        }
        .store(in: &cancellables)
}

func setBrightness(percent: Double) {
    brightness = percent
    brightnessSubject.send(UInt8((percent / 100) * 255))
}`,
  },
  {
    title: "UIImage → RGB565",
    file: "ios-app/BadgeCompanion/Extensions/UIImage+RGB565.swift",
    code: `extension UIImage {
    /// Renders the image into a 480x480 RGB565 little-endian buffer for the ESP32 framebuffer.
    func rgb565Bytes(size: Int = 480) -> [UInt8]? {
        guard let cgImage else { return nil }
        var pixels = [UInt8](repeating: 0, count: size * size * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: &pixels, width: size, height: size, bitsPerComponent: 8,
            bytesPerRow: size * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: size, height: size))

        var out = [UInt8](); out.reserveCapacity(size * size * 2)
        for i in stride(from: 0, to: pixels.count, by: 4) {
            let r = pixels[i] >> 3, g = pixels[i + 1] >> 2, b = pixels[i + 2] >> 3
            let value = (UInt16(r) << 11) | (UInt16(g) << 5) | UInt16(b)
            out.append(UInt8(value & 0xFF))
            out.append(UInt8(value >> 8))
        }
        return out
    }
}`,
  },
];
