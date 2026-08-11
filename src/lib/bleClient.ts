import { encodeToRgb565 } from "./imageEncode";
import {
  BLE_CHUNK_SIZE,
  DEVICE_NAME_PREFIX,
  E36_CHARACTERISTICS,
  E36_SERVICE_UUID,
} from "./protocol";
import type { AnimationFrame, BadgeConfig, BadgeInfo, CharacteristicSnapshot, LogLevel } from "../types";

export type BleLogger = (level: LogLevel, message: string, detail?: string) => void;

export interface TransferProgress {
  sentBytes: number;
  totalBytes: number;
  percent: number;
  frameIndex?: number;
  totalFrames?: number;
}

export type ProgressHandler = (progress: TransferProgress) => void;

const CHUNK_DELAY_MS = 8;
const SIMULATED_LATENCY_MS = 220;

function randomHexId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps the Web Bluetooth API to talk to an E36 badge, with a built-in
 * software simulation mode used when Web Bluetooth is unavailable or when
 * the user explicitly wants to try the app without real hardware.
 */
export class BadgeBleClient {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristics = new Map<string, BluetoothRemoteGATTCharacteristic>();

  public simulated = false;
  private simulatedBrightness = 72;
  private simulatedBattery = 86;

  onLog: BleLogger = () => {};
  onDisconnected: () => void = () => {};

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  get isConnected(): boolean {
    if (this.simulated) return this.simulatedConnected;
    return !!this.server?.connected;
  }

  private simulatedConnected = false;

  getCharacteristicSnapshots(): CharacteristicSnapshot[] {
    const labels: [string, string][] = [
      [E36_CHARACTERISTICS.DEVICE_INFO, "Device Info"],
      [E36_CHARACTERISTICS.BRIGHTNESS, "Brightness"],
      [E36_CHARACTERISTICS.FACE_TRANSFER, "Face Transfer"],
      [E36_CHARACTERISTICS.ANIMATION_TRANSFER, "Animation Transfer"],
      [E36_CHARACTERISTICS.BATTERY_STATUS, "Battery Status"],
    ];
    return labels.map(([uuid, label]) => ({
      uuid,
      label,
      properties: this.characteristics.has(uuid)
        ? this.propsToList(this.characteristics.get(uuid)!.properties)
        : this.simulated
          ? this.defaultSimProps(label)
          : [],
      lastValuePreview: "—",
      lastUpdated: null,
    }));
  }

  private propsToList(props: BluetoothCharacteristicProperties): string[] {
    const out: string[] = [];
    if (props.read) out.push("read");
    if (props.write || props.writeWithoutResponse) out.push("write");
    if (props.notify) out.push("notify");
    if (props.indicate) out.push("indicate");
    return out;
  }

  private defaultSimProps(label: string): string[] {
    if (label === "Device Info") return ["read"];
    if (label === "Brightness") return ["read", "write"];
    if (label === "Battery Status") return ["read", "notify"];
    return ["write"];
  }

  async connect(): Promise<BadgeInfo> {
    if (!BadgeBleClient.isSupported()) {
      throw new Error("WEB_BLUETOOTH_UNSUPPORTED");
    }

    this.onLog("info", "Requesting Bluetooth device…", `filters: namePrefix=${DEVICE_NAME_PREFIX}`);
    this.device = await navigator.bluetooth!.requestDevice({
      filters: [{ namePrefix: DEVICE_NAME_PREFIX }, { services: [E36_SERVICE_UUID] }],
      optionalServices: [E36_SERVICE_UUID],
    });

    this.onLog("gatt", `Device selected: ${this.device.name ?? "Unknown"}`, this.device.id);
    this.device.addEventListener("gattserverdisconnected", () => {
      this.onLog("warn", "GATT server disconnected");
      this.onDisconnected();
    });

    this.onLog("info", "Connecting to GATT server…");
    this.server = await this.device.gatt!.connect();
    this.onLog("success", "GATT server connected");

    this.onLog("info", `Discovering primary service ${E36_SERVICE_UUID}`);
    this.service = await this.server.getPrimaryService(E36_SERVICE_UUID);
    this.onLog("success", "E36 badge service discovered");

    for (const uuid of Object.values(E36_CHARACTERISTICS)) {
      try {
        const ch = await this.service.getCharacteristic(uuid);
        this.characteristics.set(uuid, ch);
        this.onLog("gatt", `Characteristic ready: ${uuid}`);
      } catch (err) {
        this.onLog("warn", `Characteristic unavailable: ${uuid}`, String(err));
      }
    }

    return this.readDeviceInfo();
  }

  async connectSimulated(): Promise<BadgeInfo> {
    this.simulated = true;
    this.onLog("info", "Starting simulated BLE session (Demo Mode)");
    await delay(SIMULATED_LATENCY_MS);
    this.onLog("gatt", "Virtual device selected: E36-Badge-3F21", randomHexId(6));
    await delay(SIMULATED_LATENCY_MS);
    this.onLog("success", "Virtual GATT server connected");
    await delay(SIMULATED_LATENCY_MS / 2);
    this.onLog("success", "E36 badge service discovered (simulated)");
    for (const uuid of Object.values(E36_CHARACTERISTICS)) {
      await delay(60);
      this.onLog("gatt", `Characteristic ready: ${uuid}`);
    }
    this.simulatedConnected = true;
    return this.readDeviceInfo();
  }

  async disconnect(): Promise<void> {
    if (this.simulated) {
      this.onLog("info", "Ending simulated session");
      this.simulatedConnected = false;
      this.onDisconnected();
      return;
    }
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.characteristics.clear();
    this.service = null;
    this.server = null;
    this.device = null;
  }

  async readDeviceInfo(): Promise<BadgeInfo> {
    if (this.simulated) {
      await delay(140);
      const info: BadgeInfo = {
        name: "E36-Badge-3F21",
        firmwareVersion: "1.4.2",
        hardwareRevision: "Rev C",
        batteryPercent: this.simulatedBattery,
        brightness: this.simulatedBrightness,
        totalStorageKb: 4096,
        usedStorageKb: 1180,
      };
      this.onLog("info", "Read device info characteristic", JSON.stringify(info));
      return info;
    }

    const ch = this.characteristics.get(E36_CHARACTERISTICS.DEVICE_INFO);
    if (!ch) throw new Error("Device info characteristic not found");
    const view = await ch.readValue();
    this.onLog("gatt", "Read device info characteristic", `${view.byteLength} bytes`);

    // Best-effort decode; real firmware would define a fixed binary layout.
    // Fall back to sensible defaults if the payload doesn't match.
    const battery = view.byteLength > 0 ? view.getUint8(0) : 100;
    const brightness = view.byteLength > 1 ? view.getUint8(1) : 70;

    return {
      name: this.device?.name ?? "E36 Badge",
      firmwareVersion: "1.4.2",
      hardwareRevision: "Rev C",
      batteryPercent: battery,
      brightness,
      totalStorageKb: 4096,
      usedStorageKb: 1180,
    };
  }

  async setBrightness(value: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    if (this.simulated) {
      await delay(120);
      this.simulatedBrightness = clamped;
      this.onLog("gatt", `Wrote brightness characteristic`, `value=${clamped}`);
      return;
    }
    const ch = this.characteristics.get(E36_CHARACTERISTICS.BRIGHTNESS);
    if (!ch) throw new Error("Brightness characteristic not found");
    const buf = new Uint8Array([clamped]);
    await ch.writeValue(buf);
    this.onLog("gatt", "Wrote brightness characteristic", `value=${clamped}`);
  }

  async sendFace(dataUrl: string, name: string, onProgress: ProgressHandler): Promise<number> {
    this.onLog("info", `Encoding face "${name}" to RGB565…`);
    const payload = await encodeToRgb565(dataUrl);
    this.onLog("info", `Encoded payload ready`, `${payload.byteLength} bytes`);
    await this.transferChunks(payload, E36_CHARACTERISTICS.FACE_TRANSFER, onProgress);
    return payload.byteLength;
  }

  async sendFrame(dataUrl: string, onProgress: ProgressHandler): Promise<number> {
    this.onLog("info", "Encoding live frame to RGB565…");
    const payload = await encodeToRgb565(dataUrl);
    this.onLog("info", "Encoded live frame ready", `${payload.byteLength} bytes`);
    await this.transferChunks(payload, E36_CHARACTERISTICS.FACE_TRANSFER, onProgress, "live frame");
    return payload.byteLength;
  }

  async saveConfig(_config: BadgeConfig): Promise<void> {
    // Persistent settings are handled by the WiFi firmware; BLE has no such channel.
  }

  async sendAnimation(frames: AnimationFrame[], onProgress: ProgressHandler): Promise<number> {
    let totalBytes = 0;
    const encoded: Uint8Array[] = [];
    for (const frame of frames) {
      const bytes = await encodeToRgb565(frame.dataUrl);
      encoded.push(bytes);
      totalBytes += bytes.byteLength;
    }

    this.onLog("info", `Encoded ${frames.length} animation frames`, `${totalBytes} bytes total`);

    let sentBytes = 0;
    for (let i = 0; i < encoded.length; i++) {
      const bytes = encoded[i];
      await this.transferChunks(
        bytes,
        E36_CHARACTERISTICS.ANIMATION_TRANSFER,
        (progress) => {
          onProgress({
            sentBytes: sentBytes + progress.sentBytes,
            totalBytes,
            percent: Math.round(((sentBytes + progress.sentBytes) / totalBytes) * 100),
            frameIndex: i + 1,
            totalFrames: encoded.length,
          });
        },
        `frame ${i + 1}/${encoded.length}`,
      );
      sentBytes += bytes.byteLength;
    }

    return totalBytes;
  }

  private async transferChunks(
    payload: Uint8Array,
    characteristicUuid: string,
    onProgress: ProgressHandler,
    context?: string,
  ): Promise<void> {
    const totalBytes = payload.byteLength;
    let sentBytes = 0;
    const chunkCount = Math.ceil(totalBytes / BLE_CHUNK_SIZE);

    const ch = this.simulated ? null : this.characteristics.get(characteristicUuid);
    if (!this.simulated && !ch) {
      throw new Error(`Characteristic ${characteristicUuid} not found`);
    }

    this.onLog(
      "info",
      `Starting chunked transfer${context ? ` (${context})` : ""}`,
      `${chunkCount} chunks × ${BLE_CHUNK_SIZE}B → ${characteristicUuid}`,
    );

    for (let i = 0; i < chunkCount; i++) {
      const start = i * BLE_CHUNK_SIZE;
      const end = Math.min(start + BLE_CHUNK_SIZE, totalBytes);
      const chunk = payload.slice(start, end);

      if (this.simulated) {
        await delay(CHUNK_DELAY_MS);
      } else if (ch) {
        await ch.writeValueWithoutResponse(chunk);
      }

      sentBytes += chunk.byteLength;

      if (i % 8 === 0 || i === chunkCount - 1) {
        this.onLog("gatt", `Wrote chunk ${i + 1}/${chunkCount}`, `${chunk.byteLength} bytes`);
      }

      onProgress({
        sentBytes,
        totalBytes,
        percent: Math.round((sentBytes / totalBytes) * 100),
      });
    }

    this.onLog("success", `Transfer complete${context ? ` (${context})` : ""}`, `${totalBytes} bytes`);
  }
}
