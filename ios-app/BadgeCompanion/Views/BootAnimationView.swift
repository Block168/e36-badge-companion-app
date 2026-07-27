import SwiftUI
import PhotosUI

struct BootAnimationView<Manager: BLEManaging>: View {
    @EnvironmentObject var ble: Manager

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var frames: [GIFDecoder.Frame] = []
    @State private var previewIndex = 0
    @State private var isPlaying = false
    @State private var bootAnimEnabled = false
    @State private var isUploading = false
    @State private var uploadedCount = 0

    private let timer = Timer.publish(every: 0.12, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                if let frame = frames[safe: previewIndex] {
                    Image(uiImage: frame.image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 160, height: 160)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(.blue.opacity(0.6), lineWidth: 3))
                } else {
                    Circle().fill(.gray.opacity(0.15)).frame(width: 160, height: 160)
                        .overlay(Text("No frames").font(.caption).foregroundStyle(.secondary))
                }

                Text("\(frames.count)/\(maxBootAnimationFrames) frames")
                    .font(.caption).foregroundStyle(.secondary)

                Button(isPlaying ? "Pause Preview" : "Preview Loop") { isPlaying.toggle() }
                    .disabled(frames.count < 2)

                PhotosPicker(selection: $pickerItems, maxSelectionCount: maxBootAnimationFrames, matching: .images) {
                    Label("Add Frames / GIF", systemImage: "photo.stack")
                }
                .buttonStyle(.bordered)

                Toggle("Enable Custom Boot Sequence", isOn: $bootAnimEnabled)
                    .onChange(of: bootAnimEnabled) { _, newValue in
                        ble.setBootAnimationEnabled(newValue)
                    }
                    .padding(.horizontal)

                if isUploading {
                    ProgressView(value: Double(uploadedCount), total: Double(frames.count)) {
                        Text("Uploading frame \(uploadedCount + 1) of \(frames.count)")
                    }
                    .padding(.horizontal)
                }

                Button {
                    uploadAll()
                } label: {
                    Label("Upload Sequence to Badge", systemImage: "arrow.up.doc")
                }
                .buttonStyle(.borderedProminent)
                .disabled(frames.isEmpty || isUploading)

                Spacer()
            }
            .padding(.top)
            .navigationTitle("Boot Animation")
            .onChange(of: pickerItems) { _, items in loadFrames(from: items) }
            .onReceive(timer) { _ in
                guard isPlaying, !frames.isEmpty else { return }
                previewIndex = (previewIndex + 1) % frames.count
            }
        }
    }

    private func loadFrames(from items: [PhotosPickerItem]) {
        Task {
            var images: [UIImage] = []
            for item in items.prefix(maxBootAnimationFrames) {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    // A single .gif selection decodes multiple frames via ImageIO;
                    // plain photos each become a single frame.
                    if let gifFrames = try? decodeIfGIF(data), !gifFrames.isEmpty {
                        images.append(contentsOf: gifFrames.map(\.image))
                    } else if let image = UIImage(data: data) {
                        images.append(image)
                    }
                }
            }
            frames = GIFDecoder.framesFromPhotos(images)
        }
    }

    private func decodeIfGIF(_ data: Data) throws -> [GIFDecoder.Frame] {
        GIFDecoder.decode(data: data)
    }

    private func uploadAll() {
        isUploading = true
        uploadedCount = 0
        uploadNext(index: 0)
    }

    private func uploadNext(index: Int) {
        guard index < frames.count else {
            isUploading = false
            bootAnimEnabled = true
            ble.setBootAnimationEnabled(true)
            return
        }
        guard let buffer = frames[index].image.maskedToCircle(diameter: 480).rgb565Bytes(size: 480) else {
            uploadNext(index: index + 1)
            return
        }
        ble.sendImage(buffer, frameIndex: UInt8(index), totalFrames: frames.count) { success in
            uploadedCount = index + (success ? 1 : 0)
            uploadNext(index: index + 1)
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
