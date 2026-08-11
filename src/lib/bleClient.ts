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

  // Transfer reliability tuning.
  private attMtu: number | null = null;
  private maxOutstandingWrites = 4; // never flood the ATT write queue
  private chunkRetries = 3;
  private retryBaseDelayMs = 40;
  private failedWrites = 0;
  private simulatedFailureRate = 0; // test hook: inject failures into demo mode

  /** Test/debug hook — randomly fail a chunk's FIRST write (0..1) to exercise retries. */
  setSimulatedFailureRate(rate: number): void {
    this.simulatedFailureRate = Math.max(0, Math.min(1, rate));
  }

  /** Number of write attempts that failed once and were recovered by retry. */
  get failedWriteCount(): number {
    return this.failedWrites;
  }

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

    this.onLog("info", "Negotiating ATT MTU…");
    const gatt = this.device.gatt!;
    const requestMTU = (gatt as unknown as { requestMTU?: (mtu: number) => Promise<number> }).requestMTU;
    if (requestMTU) {
      try {
        const mtu = await requestMTU(512);
        if (mtu > 0) this.attMtu = mtu;
        this.onLog("success", "ATT MTU negotiated", `mtu=${this.attMtu ?? "default"}`);
      } catch (err) {
        this.attMtu = null;
        this.onLog("warn", "MTU negotiation not supported — using default chunk size", String(err));
      }
    } else {
      this.onLog("warn", "MTU negotiation not supported — using default chunk size", "requestMTU unavailable");
    }

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
    this.attMtu = 512;
    this.onLog("success", "ATT MTU negotiated (simulated)", "mtu=512");
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

  private effectiveMtu(): number {
    if (this.attMtu) return this.attMtu;
    return BLE_CHUNK_SIZE + 3;
  }

  /**
   * Sends a payload to a characteristic with reliable, flow-controlled chunking.
   *
   * Reliability strategy:
   *   - Chunk size is derived from the negotiated ATT MTU (up to ~509 bytes),
   *     so far fewer writes are needed for the same payload.
   *   - A bounded sliding window keeps at most `maxOutstandingWrites` writes in
   *     flight, which respects the OS/controller write queue on phones instead
   *     of fire-and-forgetting every chunk back-to-back.
   *   - Every write is retried with exponential backoff, so transient GATT
   *     errors ("queue full", "operation already in progress") recover instead
   *     of aborting the whole upload.
   */
  private async transferChunks(
    payload: Uint8Array,
    characteristicUuid: string,
    onProgress: ProgressHandler,
    context?: string,
  ): Promise<void> {
    const totalBytes = payload.byteLength;
    const mtu = this.effectiveMtu();
    const chunkSize = Math.max(20, mtu - 3);
    const chunkCount = Math.ceil(totalBytes / chunkSize);

    const ch = this.simulated ? null : (this.characteristics.get(characteristicUuid) ?? null);
    if (!this.simulated && !ch) {
      throw new Error(`Characteristic ${characteristicUuid} not found`);
    }

    this.onLog(
      "info",
      `Starting chunked transfer${context ? ` (${context})` : ""}`,
      `${chunkCount} chunks × ${chunkSize}B (MTU ${mtu}) → ${characteristicUuid}`,
    );

    let nextIndex = 0;
    let sentBytes = 0;

    const writeOne = async (index: number): Promise<void> => {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      const chunk = payload.slice(start, end);
      await this.writeChunkWithRetry(chunk, ch);
      sentBytes += chunk.byteLength;
      onProgress({
        sentBytes,
        totalBytes,
        percent: Math.round((sentBytes / totalBytes) * 100),
      });
    };

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = nextIndex++;
        if (index >= chunkCount) return;
        await writeOne(index);
      }
    };

    await Promise.all(Array.from({ length: this.maxOutstandingWrites }, () => worker()));

    if (this.failedWrites > 0) {
      this.onLog("warn", `Transfer recovered from ${this.failedWrites} failed write(s)`);
    }
    this.onLog("success", `Transfer complete${context ? ` (${context})` : ""}`, `${totalBytes} bytes`);
  }

  private async writeChunkWithRetry(
    chunk: Uint8Array,
    characteristic: BluetoothRemoteGATTCharacteristic | null,
  ): Promise<void> {
    let attempt = 0;
    let firstAttempt = true;
    for (;;) {
      try {
        if (this.simulated) {
          const isFirst = firstAttempt;
          firstAttempt = false;
          if (isFirst && this.simulatedFailureRate > 0 && Math.random() < this.simulatedFailureRate) {
            throw new Error("SIMULATED_WRITE_FAILURE");
          }
          await delay(CHUNK_DELAY_MS);
        } else if (characteristic) {
          await characteristic.writeValueWithoutResponse(new Uint8Array(chunk));
        }
        return;
      } catch (err) {
        attempt++;
        if (attempt > this.chunkRetries) throw err;
        this.failedWrites++;
        const wait = this.retryBaseDelayMs * 2 ** (attempt - 1);
        this.onLog("warn", `Write failed (attempt ${attempt}/${this.chunkRetries}), retrying in ${wait}ms`, String(err));
        await delay(wait);
      }
    }
  }
}
