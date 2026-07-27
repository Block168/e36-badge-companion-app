// Shared types for the E36 Badge Companion web simulator.
// These mirror the enums/structs used in the native Swift BLEManager
// so the simulator's behavior stays honest to the real GATT protocol.

export type ConnectionState =
  | "poweredOff"
  | "unauthorized"
  | "idle"
  | "scanning"
  | "connecting"
  | "discoveringServices"
  | "ready"
  | "disconnected";

export interface DiscoveredBadge {
  id: string;
  name: string;
  rssi: number;
}

export interface PresetFace {
  index: number;
  name: string;
  image: string;
}

export interface CustomFace {
  id: string;
  name: string;
  dataUrl: string; // 480x480 cropped preview, stand-in for the RGB565 buffer
  createdAt: number;
  sizeBytes: number; // simulated RGB565 buffer size (480*480*2)
  slotIndex: number; // face_select index assigned to this custom slot (100+)
}

export type TransferPhase =
  | "idle"
  | "preparing"
  | "converting"
  | "uploading"
  | "ack-wait"
  | "complete"
  | "error"
  | "cancelled";

export interface TransferProgress {
  phase: TransferPhase;
  chunkIndex: number;
  totalChunks: number;
  frameIndex?: number;
  totalFrames?: number;
  bytesSent: number;
  totalBytes: number;
  error?: string;
}

export interface BootFrame {
  id: string;
  dataUrl: string;
}

export const MTU_PAYLOAD_BYTES = 185; // typical negotiated (ATT MTU 247 - header), queried per-peripheral on real hardware
export const IMAGE_HEADER_BYTES = 5; // frame index (1B) + total chunks (2B) + chunk index (2B)
export const RGB565_IMAGE_BYTES = 480 * 480 * 2; // 460,800 bytes per full 480x480 face
export const MAX_BOOT_FRAMES = 20; // named constant, tune to match ESP32 flash budget

export const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
export const CHAR_FACE_SELECT = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
export const CHAR_IMAGE_DATA = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
export const CHAR_BRIGHTNESS = "6E400004-B5A3-F393-E0A9-E50E24DCCA9E";
export const CHAR_BOOT_ANIM_FLAG = "6E400005-B5A3-F393-E0A9-E50E24DCCA9E";
export const CHAR_STATUS = "6E400006-B5A3-F393-E0A9-E50E24DCCA9E";
