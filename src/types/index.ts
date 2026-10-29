export type TabId = "garage" | "library" | "playlists" | "triggers" | "settings";

export const TAB_IDS: readonly TabId[] = ["garage", "library", "playlists", "triggers", "settings"];

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface BadgeInfo {
  name: string;
  firmwareVersion: string;
  hardwareRevision: string;
  batteryPercent: number;
  brightness: number;
  totalStorageKb: number;
  usedStorageKb: number;
  /** Size of the stored face/animation files; reported by firmware with upload limits. */
  faceFileBytes?: number;
  animFileBytes?: number;
}

export interface PresetFace {
  id: string;
  name: string;
  description: string;
  accent: string;
  category: "motorsport" | "utility" | "minimal";
}

export interface CustomFace {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export type FaceSource =
  | { kind: "preset"; face: PresetFace }
  | { kind: "custom"; face: CustomFace };

export interface AnimationFrame {
  id: string;
  dataUrl: string;
  durationMs: number;
  /** True when the frame is intentionally dim (e.g. the "off" half of a blink). */
  dim?: boolean;
}

export interface TransferRecord {
  id: string;
  type: "face" | "animation" | "brightness" | "frame";
  name: string;
  timestamp: number;
  sizeBytes: number;
  durationMs: number;
  success: boolean;
  detail?: string;
}

/** Settings the app can persist on the badge's flash storage. */
export interface BadgeConfig {
  active?: "face" | "animation";
  brightness?: number;
}

export type LogLevel = "info" | "success" | "warn" | "error" | "gatt";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  detail?: string;
}
