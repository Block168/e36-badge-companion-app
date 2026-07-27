import SwiftUI

struct PresetFace: Identifiable {
    let id: UInt8
    let name: String
    let assetName: String
}

let presetFaces: [PresetFace] = [
    .init(id: 0, name: "Roundel Glow", assetName: "face_roundel"),
    .init(id: 1, name: "Checkered Flag", assetName: "face_checkered"),
    .init(id: 2, name: "Speedometer", assetName: "face_gauge"),
    .init(id: 3, name: "Flame", assetName: "face_flame"),
    .init(id: 4, name: "Carbon Ring", assetName: "face_carbon"),
    .init(id: 5, name: "Minimal Clock", assetName: "face_clock"),
]

private let gridColumns = [GridItem(.adaptive(minimum: 90), spacing: 14)]

struct FaceGalleryView<Manager: BLEManaging>: View {
    @EnvironmentObject var ble: Manager
    @State private var selectedIndex: UInt8 = 0
    @State private var showUploader = false

    var body: some View {
        NavigationStack {
            ScrollView {
                // Live circular preview matching the badge's round IPS panel.
                if let face = presetFaces.first(where: { $0.id == selectedIndex }) {
                    Image(face.assetName)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 120, height: 120)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(.blue, lineWidth: 3))
                        .padding(.top, 12)
                }

                LazyVGrid(columns: gridColumns, spacing: 16) {
                    ForEach(presetFaces) { face in
                        Button {
                            selectedIndex = face.id
                            ble.selectFace(index: face.id)
                        } label: {
                            VStack(spacing: 6) {
                                Image(face.assetName)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 84, height: 84)
                                    .clipShape(Circle())
                                    .overlay(
                                        Circle().stroke(selectedIndex == face.id ? Color.blue : .clear, lineWidth: 3)
                                    )
                                Text(face.name).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        .disabled({ if case .ready = ble.state { return false } else { return true } }())
                    }
                }
                .padding()

                Button {
                    showUploader = true
                } label: {
                    Label("Upload Custom Face", systemImage: "photo.badge.plus")
                }
                .buttonStyle(.borderedProminent)
                .padding(.bottom, 24)
            }
            .navigationTitle("Face Gallery")
            .sheet(isPresented: $showUploader) {
                CustomFaceEditorView<Manager>()
            }
        }
    }
}
