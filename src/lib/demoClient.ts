import { encodeToRgb565 } from "./imageEncode";
import type { ProgressHandler } from "./wifiClient";
import type { AnimationFrame, BadgeConfig, BadgeInfo, LogLevel } from "../types";

export type DemoLogger = (level: LogLevel, message: string, detail?: string) => void;

const LATENCY_MS = 220;
const CHUNK_BYTES = 4096;
const CHUNK_DELAY_MS = 8;
const CHUNK_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 40;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A software badge for Demo Mode: same surface as BadgeWifiClient, with
 * realistic latency, chunked progress and optional injected write failures
 * (used by the stress test to exercise retry handling).
 */
export class BadgeDemoClient {
  public readonly transport = "demo" as const;
  private connected = false;
  private brightness = 72;
  private battery = 86;
  private failures = 0;
  private failureRate = 0;

  onLog: DemoLogger = () => {};
  onDisconnected: () => void = () => {};

  get isConnected(): boolean {
    return this.connected;
  }

  /** Test hook — randomly fail a chunk's first write (0..1) to exercise retries. */
  setSimulatedFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  get simulatedFailureRate(): number {
    return this.failureRate;
  }

  /** Writes that failed once and were recovered by a retry. */
  get failedWriteCount(): number {
    return this.failures;
  }

  async connect(): Promise<BadgeInfo> {
    this.onLog("info", "Starting Demo Mode badge");
    await delay(LATENCY_MS * 2);
    this.connected = true;
    this.onLog("success", "Demo badge ready");
    return this.readDeviceInfo();
  }

  async disconnect(): Promise<void> {
    this.onLog("info", "Ending demo session");
    this.connected = false;
    this.onDisconnected();
  }

  async readDeviceInfo(): Promise<BadgeInfo> {
    await delay(140);
    return {
      name: "E36-Badge-3F21",
      firmwareVersion: "1.4.2",
      hardwareRevision: "Rev C",
      batteryPercent: this.battery,
      brightness: this.brightness,
      // Modelled on a 16 MB flash board (~12 MB LittleFS) so a full 20-frame animation fits.
      totalStorageKb: 12288,
      usedStorageKb: 1180,
      faceFileBytes: 0,
      animFileBytes: 0,
    };
  }

  async setBrightness(value: number): Promise<void> {
    await delay(120);
    this.brightness = Math.max(0, Math.min(100, Math.round(value)));
    this.onLog("info", "Set brightness", `value=${this.brightness}`);
  }

  async saveConfig(config: BadgeConfig): Promise<void> {
    this.onLog("info", "Saved startup settings", JSON.stringify(config));
  }

  async sendFace(dataUrl: string, name: string, onProgress: ProgressHandler): Promise<number> {
    const payload = await encodeToRgb565(dataUrl);
    await this.upload(payload, onProgress, `face "${name}"`);
    return payload.byteLength;
  }

  async sendFrame(dataUrl: string, onProgress: ProgressHandler): Promise<number> {
    const payload = await encodeToRgb565(dataUrl);
    await this.upload(payload, onProgress, "live frame");
    return payload.byteLength;
  }

  async sendAnimation(frames: AnimationFrame[], onProgress: ProgressHandler): Promise<number> {
    const encoded = await Promise.all(frames.map((f) => encodeToRgb565(f.dataUrl)));
    const totalBytes = encoded.reduce((t, b) => t + b.byteLength, 0);
    const payload = new Uint8Array(totalBytes);
    let offset = 0;
    for (const bytes of encoded) {
      payload.set(bytes, offset);
      offset += bytes.byteLength;
    }
    await this.upload(
      payload,
      (p) => onProgress({ ...p, frameIndex: Math.min(frames.length, Math.floor((p.percent / 100) * frames.length) + 1), totalFrames: frames.length }),
      `${frames.length}-frame animation`,
    );
    return totalBytes;
  }

  private async upload(payload: Uint8Array, onProgress: ProgressHandler, what: string): Promise<void> {
    const totalBytes = payload.byteLength;
    this.onLog("info", `Uploading ${what}`, `${totalBytes} bytes`);
    for (let sent = 0; sent < totalBytes; ) {
      const size = Math.min(CHUNK_BYTES, totalBytes - sent);
      await this.writeWithRetry();
      sent += size;
      onProgress({ sentBytes: sent, totalBytes, percent: Math.round((sent / totalBytes) * 100) });
    }
    this.onLog("success", `Upload complete (${what})`);
  }

  private async writeWithRetry(): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        if (attempt === 0 && this.failureRate > 0 && Math.random() < this.failureRate) {
          throw new Error("SIMULATED_WRITE_FAILURE");
        }
        await delay(CHUNK_DELAY_MS);
        return;
      } catch (err) {
        if (attempt >= CHUNK_RETRIES) throw err;
        this.failures++;
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
}
