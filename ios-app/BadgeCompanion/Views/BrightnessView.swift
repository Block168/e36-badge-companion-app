import SwiftUI

struct BrightnessView<Manager: BLEManaging>: View {
    @EnvironmentObject var ble: Manager
    @State private var sliderValue: Double = 0
    @State private var didInitialize = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                ZStack {
                    Circle()
                        .stroke(.gray.opacity(0.2), lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: sliderValue / 100)
                        .stroke(.blue, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack {
                        Text("\(Int(sliderValue))%").font(.largeTitle).bold()
                        Text("byte \(UInt8((sliderValue / 100) * 255))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .frame(width: 180, height: 180)
                .padding(.top, 24)

                HStack {
                    Image(systemName: "sun.min")
                    // Every change here funnels through BadgeBLEManager's
                    // Combine `.debounce(for: .milliseconds(100))` pipeline,
                    // so dragging fast never floods the peripheral with writes.
                    Slider(value: $sliderValue, in: 0...100) { editing in
                        if !editing { ble.setBrightness(percent: sliderValue) }
                    }
                    .onChange(of: sliderValue) { _, newValue in
                        ble.setBrightness(percent: newValue)
                    }
                    Image(systemName: "sun.max.fill")
                }
                .padding(.horizontal)

                Spacer()
            }
            .padding()
            .navigationTitle("Brightness")
            .onReceive(ble.statePublisher) { state in
                // Initialize the slider from the peripheral's current value
                // once, right after the brightness characteristic is read.
                if case .ready = state, !didInitialize {
                    didInitialize = true
                    sliderValue = ble.brightness
                }
            }
        }
    }
}
