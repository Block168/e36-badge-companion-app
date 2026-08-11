import { encodeToRgb565 } from "./imageEncode";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";
import type { AnimationFrame, BadgeConfig, BadgeInfo, LogLevel } from "../types";

export type WifiLogger = (level: LogLevel, message: string, detail?: string) => void;

export interface TransferProgress {
  sentBytes: number;
  totalBytes: number;
  percent: number;
  frameIndex?: number;
  totalFrames?: number;
}

export type ProgressHandler = (progress: TransferProgress) => void;

// 480x480 RGB565 payload size per frame.
const FRAME_SIZE = DISPLAY_WIDTH * DISPLAY_HEIGHT * 2;

/**
 * Talks to the E36 badge over HTTP instead of BLE.
 *
 * The badge's ESP32 runs a soft-AP that serves this very app (single-file
 * build) and exposes a REST API under /api. When the page is served from the
 * badge the API is same-origin; when the page is hosted elsewhere (e.g. the
 * Vercel preview) we fall back to the badge's fixed AP address. Browsers block
 * mixed content, so WiFi mode only works end-to-end from the badge-served app.
 */
export class BadgeWifiClient {
  public readonly transport = "wifi" as const;
  private connectedFlag = false;

  onLog: WifiLogger = () => {};
  onDisconnected: () => void = () => {};

  static isSupported(): boolean {
    return true;
  }

  get isConnected(): boolean {
    return this.connectedFlag;
  }

  private apiRoot(): string {
    if (typeof location === "undefined") return "/api";
    const host = location.hostname;
    if (
      host === "" ||
      host === "192.168.4.1" ||
      host.startsWith("192.168.4.") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return "/api";
    }
    return "http://192.168.4.1/api";
  }

  async connect(): Promise<BadgeInfo> {
    this.onLog("info", "Probing badge HTTP API…", this.apiRoot());
    const info = await this.fetchJson("/info", { timeoutMs: 6000 });
    this.connectedFlag = true;
    this.onLog("success", `Badge reached: ${info.name}`, this.apiRoot());
    return info as unknown as BadgeInfo;
  }

  async disconnect(): Promise<void> {
    if (this.connectedFlag) {
      this.onLog("info", "Closing WiFi session (HTTP link is stateless)");
    }
    this.connectedFlag = false;
    this.onDisconnected();
  }

  async readDeviceInfo(): Promise<BadgeInfo> {
    const info = await this.fetchJson("/info", { timeoutMs: 6000 });
    return info as unknown as BadgeInfo;
  }

  async setBrightness(value: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    await this.fetchJson("/brightness", {
      method: "POST",
      body: JSON.stringify({ value: clamped }),
      timeoutMs: 6000,
    });
    this.onLog("success", "Sent brightness to badge", `value=${clamped}`);
  }

  async sendFace(dataUrl: string, name: string, onProgress: ProgressHandler): Promise<number> {
    this.onLog("info", `Encoding face "${name}" to RGB565…`);
    const payload = await encodeToRgb565(dataUrl);
    this.onLog("info", "Encoded payload ready", `${payload.byteLength} bytes`);
    await this.uploadBlob("/face", payload, onProgress);
    return payload.byteLength;
  }

  async sendFrame(dataUrl: string, onProgress: ProgressHandler): Promise<number> {
    this.onLog("info", "Encoding live frame to RGB565…");
    const payload = await encodeToRgb565(dataUrl);
    this.onLog("info", "Encoded live frame ready", `${payload.byteLength} bytes`);
    await this.uploadBlob("/frame", payload, onProgress);
    return payload.byteLength;
  }

  async saveConfig(config: BadgeConfig): Promise<void> {
    await this.fetchJson("/config", {
      method: "POST",
      body: JSON.stringify(config),
      timeoutMs: 6000,
    });
    this.onLog("success", "Saved persistent settings on badge", JSON.stringify(config));
  }

  async sendAnimation(frames: AnimationFrame[], onProgress: ProgressHandler): Promise<number> {
    this.onLog("info", `Encoding ${frames.length} animation frames to RGB565…`);
    const encoded: Uint8Array[] = [];
    let totalBytes = 0;
    for (const frame of frames) {
      const bytes = await encodeToRgb565(frame.dataUrl);
      encoded.push(bytes);
      totalBytes += bytes.byteLength;
    }

    // Header: uint16 frame count + uint32 frame byte size, followed by raw frames.
    const header = new Uint8Array(6);
    new DataView(header.buffer).setUint16(0, frames.length, false);
    new DataView(header.buffer).setUint32(2, FRAME_SIZE, false);

    const payload = new Uint8Array(header.byteLength + totalBytes);
    payload.set(header, 0);
    let offset = header.byteLength;
    for (const bytes of encoded) {
      payload.set(bytes, offset);
      offset += bytes.byteLength;
    }

    this.onLog("info", "Animation payload ready", `${payload.byteLength} bytes (${frames.length} frames)`);

    await this.uploadBlob("/animation", payload, (progress) => {
      const frameIndex = Math.min(frames.length, Math.floor((progress.percent / 100) * frames.length) + 1);
      onProgress({ ...progress, frameIndex, totalFrames: frames.length });
    });

    return totalBytes;
  }

  private async fetchJson(
    path: string,
    opts: { method?: string; body?: string; timeoutMs?: number } = {},
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await fetch(this.apiRoot() + path, {
        method: opts.method ?? "GET",
        headers: opts.body ? { "Content-Type": "application/json" } : undefined,
        body: opts.body,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("TIMED_OUT");
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private uploadBlob(
    path: string,
    bytes: Uint8Array,
    onProgress: ProgressHandler,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes).buffer], { type: "application/octet-stream" }), "payload.bin");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", this.apiRoot() + path);
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        onProgress({
          sentBytes: e.loaded,
          totalBytes: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("NETWORK_ERROR"));
      xhr.ontimeout = () => reject(new Error("TIMED_OUT"));
      xhr.timeout = 120000;
      xhr.send(form);
    });
  }
}
