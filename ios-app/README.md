# E36 Badge Companion (iOS / SwiftUI / CoreBluetooth)

Native companion app for the ESP32-S3 round 3.4" (480×480) trunk-badge display.
This folder is a drop-in Xcode project source tree — copy it into a new
**iOS App (SwiftUI)** Xcode project (iOS 16+ deployment target) named
`BadgeCompanion` and it will compile as-is.

A live, hardware-free **web simulator** of this app's behavior (state machine,
GATT writes, chunking math, debounce timing) is the React app in the repo root —
open it in a browser to explore the UX before you have a badge to test against.

## Project layout

```
ios-app/
└── BadgeCompanion/
    ├── BLE/
    │   ├── BLEManaging.swift         // protocol shared by real + mock managers
    │   ├── BadgeBLEManager.swift     // CBCentralManager/CBPeripheral implementation
    │   └── MockBLEManager.swift      // simulator harness for development
    ├── Extensions/
    │   ├── UIImage+RGB565.swift      // CGContext-based RGB565 packing
    │   └── GIFDecoder.swift          // ImageIO/CGImageSource frame decoding
    ├── Views/
    │   ├── ContentView.swift         // root TabView + persistent status pill
    │   ├── FaceGalleryView.swift     // preset grid + circular live preview
    │   ├── CustomFaceEditorView.swift// PhotosPicker + circular crop + upload
    │   ├── BrightnessView.swift      // debounced slider
    │   └── BootAnimationView.swift   // frame sequence import/preview/upload
    └── Info-plist-additions.xml      // keys + background mode to merge in
```

## Setup steps

1. Create a new Xcode project → App → SwiftUI → iOS 16+.
2. Drag the `BadgeCompanion` folder contents into the project (checking
   "Copy items if needed").
3. Merge the keys from `Info-plist-additions.xml` into your `Info.plist`
   (Bluetooth usage description + `bluetooth-central` background mode).
4. In `BadgeCompanionApp.swift`, own a single `@StateObject var ble =
   BadgeBLEManager()` and inject it with `.environmentObject(ble)`, then call
   `ble.start()` from `.onAppear` on `ContentView`.
5. Build & run on a physical device (CoreBluetooth central role does not work
   in the iOS Simulator) — for simulator work, use `MockBLEManager` instead by
   swapping which type conforms to `BLEManaging` that you inject.

## GATT contract (must stay in sync with the ESP32 firmware)

| Characteristic     | Properties     | Payload |
|---------------------|---------------|---------|
| `face_select`        | Write          | 1 byte preset/custom face index |
| `image_data`          | Write, chunked | `[frameIndex:1B][totalChunks:2B][chunkIndex:2B][payload]` |
| `brightness`          | Read / Write   | 1 byte, 0–255 |
| `boot_anim_flag`      | Write          | 1 byte, 0/1 |
| `status`               | Notify         | 1 byte ack/progress/error code |

Service UUID and all characteristic UUIDs are declared as constants at the top
of `BadgeBLEManager.swift` — update them there once firmware UUIDs are final.
