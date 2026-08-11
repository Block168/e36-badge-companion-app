export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface BadgeInfo {
  name: string;
  firmwareVersion: string;
  hardwareRevision: string;
  batteryPercent: number;
  brightness: number;
  totalStorageKb: number;
  usedStorageKb: number;
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
  type: "face" | "animation" | "brightness";
  name: string;
  timestamp: number;
  sizeBytes: number;
  durationMs: number;
  success: boolean;
  detail?: string;
}

export type LogLevel = "info" | "success" | "warn" | "error" | "gatt";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  detail?: string;
}

export interface CharacteristicSnapshot {
  uuid: string;
  label: string;
  properties: string[];
  lastValuePreview: string;
  lastUpdated: number | null;
}
