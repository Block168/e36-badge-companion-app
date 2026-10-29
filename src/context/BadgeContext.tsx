import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BadgeWifiClient, type ProgressHandler } from "../lib/wifiClient";
import { BadgeDemoClient } from "../lib/demoClient";
import { FACE_BYTES, animationBytes, assertFits, BadgeStorageError } from "../lib/capacity";
import { loadHistory, saveHistory, loadCustomFaces, saveCustomFaces, loadLastBrightness, saveLastBrightness } from "../lib/storage";
import type {
  AnimationFrame,
  BadgeInfo,
  ConnectionState,
  CustomFace,
  LogEntry,
  LogLevel,
  TransferRecord,
} from "../types";

interface ToastMessage {
  id: string;
  kind: "success" | "error" | "info";
  message: string;
}

type Transport = "badge" | "demo";

export interface SendOptions {
  /** Automation-driven send: no success toast, no blocking progress modal. */
  quiet?: boolean;
  /** Save as the badge's startup content. Defaults to true. */
  persist?: boolean;
}

export interface ActiveTransfer {
  label: string;
  percent: number;
  background?: boolean;
}

interface BadgeContextValue {
  connectionState: ConnectionState;
  transport: Transport | null;
  isSimulated: boolean;
  badgeInfo: BadgeInfo | null;
  logs: LogEntry[];
  history: TransferRecord[];
  customFaces: CustomFace[];
  brightness: number;
  toasts: ToastMessage[];
  activeTransfer: ActiveTransfer | null;
  connect: () => Promise<void>;
  connectDemo: () => Promise<void>;
  disconnect: () => Promise<void>;
  setBrightness: (value: number) => void;
  commitBrightness: (value: number) => Promise<boolean>;
  /** Resolves true when the badge accepted the face. */
  sendFace: (dataUrl: string, name: string, opts?: SendOptions) => Promise<boolean>;
  sendAnimation: (
    frames: AnimationFrame[],
    name: string,
    opts?: SendOptions,
  ) => Promise<boolean>;
  sendFrame: (dataUrl: string, name: string) => Promise<void>;
  addCustomFace: (face: CustomFace) => void;
  removeCustomFace: (id: string) => void;
  clearHistory: () => void;
  clearLogs: () => void;
  dismissToast: (id: string) => void;
  pushToast: (kind: ToastMessage["kind"], message: string) => void;
}

const BadgeContext = createContext<BadgeContextValue | null>(null);

const MAX_LOGS = 250;

export function BadgeProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<BadgeWifiClient | BadgeDemoClient | null>(null);
  const batteryTimerRef = useRef<number | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [transport, setTransport] = useState<Transport | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [badgeInfo, setBadgeInfo] = useState<BadgeInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<TransferRecord[]>(() => loadHistory());
  const [customFaces, setCustomFaces] = useState<CustomFace[]>(() => loadCustomFaces());
  const [brightness, setBrightnessState] = useState<number>(() => loadLastBrightness());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);

  const pushToast = useCallback((kind: ToastMessage["kind"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const appendLog = useCallback((level: LogLevel, message: string, detail?: string) => {
    setLogs((prev) => {
      const next: LogEntry[] = [
        ...prev,
        { id: crypto.randomUUID(), timestamp: Date.now(), level, message, detail },
      ];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  const stopBatteryPolling = useCallback(() => {
    if (batteryTimerRef.current !== null) {
      window.clearInterval(batteryTimerRef.current);
      batteryTimerRef.current = null;
    }
  }, []);

  const resetConnection = useCallback(() => {
    stopBatteryPolling();
    setConnectionState("disconnected");
    setBadgeInfo(null);
    setIsSimulated(false);
    setTransport(null);
  }, [stopBatteryPolling]);

  const makeClient = useCallback(
    (kind: Transport): BadgeWifiClient | BadgeDemoClient => {
      const client = kind === "badge" ? new BadgeWifiClient() : new BadgeDemoClient();
      client.onLog = appendLog;
      client.onDisconnected = resetConnection;
      return client;
    },
    [appendLog, resetConnection],
  );

  const startBatteryPolling = useCallback(() => {
    stopBatteryPolling();
    batteryTimerRef.current = window.setInterval(async () => {
      try {
        const info = await clientRef.current?.readDeviceInfo();
        if (info) {
          setBadgeInfo((prev) => (prev ? { ...prev, batteryPercent: info.batteryPercent } : prev));
        }
      } catch {
        // a missed battery poll is fine to ignore
      }
    }, 15000);
  }, [stopBatteryPolling]);

  useEffect(() => () => stopBatteryPolling(), [stopBatteryPolling]);

  const finishConnect = useCallback(
    (info: BadgeInfo) => {
      setBadgeInfo(info);
      setBrightnessState(info.brightness);
      saveLastBrightness(info.brightness);
      setConnectionState("connected");
    },
    [],
  );

  const connect = useCallback(async () => {
    const client = makeClient("badge");
    clientRef.current = client;
    setConnectionState("connecting");
    try {
      const info = await client.connect();
      setIsSimulated(false);
      setTransport("badge");
      finishConnect(info);
      startBatteryPolling();
      pushToast("success", `Connected to ${info.name}`);
    } catch (err) {
      setConnectionState("error");
      const message = err instanceof Error ? err.message : String(err);
      pushToast(
        "error",
        message === "TIMED_OUT" || message === "NETWORK_ERROR" || message.includes("fetch")
          ? "Couldn't find your badge. Make sure your phone is joined to E36-Badge, then try again."
          : `Couldn't connect: ${message}`,
      );
      appendLog("error", "Connection attempt failed", message);
      setTimeout(() => setConnectionState((s) => (s === "error" ? "disconnected" : s)), 2200);
    }
  }, [appendLog, finishConnect, makeClient, pushToast, startBatteryPolling]);

  const connectDemo = useCallback(async () => {
    const client = makeClient("demo") as BadgeDemoClient;
    clientRef.current = client;
    // Debug/test seam: lets a headless probe or the browser console inject
    // simulated write failures and inspect recovery stats.
    if (typeof window !== "undefined") {
      (window as unknown as { __badgeDemoClient?: BadgeDemoClient }).__badgeDemoClient = client;
    }
    setConnectionState("connecting");
    try {
      const info = await client.connect();
      setIsSimulated(true);
      setTransport("demo");
      finishConnect(info);
      startBatteryPolling();
      pushToast("success", `Demo Mode connected — ${info.name}`);
    } catch (err) {
      setConnectionState("error");
      pushToast("error", "Demo connection failed unexpectedly");
      appendLog("error", "Demo connection failed", String(err));
    }
  }, [appendLog, finishConnect, makeClient, pushToast, startBatteryPolling]);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    stopBatteryPolling();
    if (client) await client.disconnect();
    setConnectionState("disconnected");
    setBadgeInfo(null);
    setIsSimulated(false);
    setTransport(null);
    pushToast("info", "Badge disconnected");
  }, [pushToast, stopBatteryPolling]);

  const setBrightness = useCallback((value: number) => {
    setBrightnessState(value);
  }, []);

  const commitBrightness = useCallback(
    async (value: number) => {
      const client = clientRef.current;
      if (connectionState !== "connected" || !client) return false;
      try {
        await client.setBrightness(value);
        saveLastBrightness(value);
        setHistory((prev) => {
          const record: TransferRecord = {
            id: crypto.randomUUID(),
            type: "brightness",
            name: `Brightness → ${value}%`,
            timestamp: Date.now(),
            sizeBytes: 1,
            durationMs: 120,
            success: true,
          };
          const next = [record, ...prev];
          saveHistory(next);
          return next;
        });
        return true;
      } catch (err) {
        pushToast("error", "Failed to update brightness");
        appendLog("error", "Brightness write failed", String(err));
        return false;
      }
    },
    [appendLog, connectionState, pushToast],
  );

  const recordTransfer = useCallback((record: TransferRecord) => {
    setHistory((prev) => {
      const next = [record, ...prev];
      saveHistory(next);
      return next;
    });
  }, []);

  const sendFace = useCallback(
    async (dataUrl: string, name: string, opts?: SendOptions) => {
      const client = clientRef.current;
      if (connectionState !== "connected" || !client) {
        if (!opts?.quiet) pushToast("error", "Connect to a badge first");
        return false;
      }
      const startedAt = Date.now();
      const background = opts?.quiet === true;
      setActiveTransfer({ label: `Sending "${name}"`, percent: 0, background });
      const onProgress: ProgressHandler = (progress) => {
        setActiveTransfer({ label: `Sending "${name}"`, percent: progress.percent, background });
      };
      try {
        // Re-read storage so the check never relies on a stale poll.
        const info = await client.readDeviceInfo();
        setBadgeInfo(info);
        assertFits(info, "face", FACE_BYTES);
        const bytes = await client.sendFace(dataUrl, name, onProgress);
        if (opts?.persist !== false) await client.saveConfig({ active: "face" });
        recordTransfer({
          id: crypto.randomUUID(),
          type: "face",
          name,
          timestamp: Date.now(),
          sizeBytes: bytes,
          durationMs: Date.now() - startedAt,
          success: true,
        });
        if (!opts?.quiet) pushToast("success", `"${name}" uploaded to badge`);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        recordTransfer({
          id: crypto.randomUUID(),
          type: "face",
          name,
          timestamp: Date.now(),
          sizeBytes: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          detail: message,
        });
        pushToast("error", err instanceof BadgeStorageError ? err.message : `Failed to send "${name}"`);
        return false;
      } finally {
        setActiveTransfer(null);
      }
    },
    [connectionState, pushToast, recordTransfer],
  );

  const sendAnimation = useCallback(
    async (frames: AnimationFrame[], name: string, opts?: SendOptions) => {
      const client = clientRef.current;
      if (connectionState !== "connected" || !client) {
        if (!opts?.quiet) pushToast("error", "Connect to a badge first");
        return false;
      }
      if (frames.length === 0) {
        pushToast("error", "Add at least one frame first");
        return false;
      }
      const startedAt = Date.now();
      const background = opts?.quiet === true;
      setActiveTransfer({ label: `Uploading animation "${name}"`, percent: 0, background });
      const onProgress: ProgressHandler = (progress) => {
        const frameLabel = progress.totalFrames ? ` (frame ${progress.frameIndex}/${progress.totalFrames})` : "";
        setActiveTransfer({
          label: `Uploading animation "${name}"${frameLabel}`,
          percent: progress.percent,
          background,
        });
      };
      try {
        const info = await client.readDeviceInfo();
        setBadgeInfo(info);
        assertFits(info, "animation", animationBytes(frames.length));
        const bytes = await client.sendAnimation(frames, onProgress);
        if (opts?.persist !== false) {
          await client.saveConfig({ active: "animation" });
        }
        recordTransfer({
          id: crypto.randomUUID(),
          type: "animation",
          name,
          timestamp: Date.now(),
          sizeBytes: bytes,
          durationMs: Date.now() - startedAt,
          success: true,
          detail: `${frames.length} frames`,
        });
        if (!opts?.quiet) pushToast("success", `Animation "${name}" uploaded`);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        recordTransfer({
          id: crypto.randomUUID(),
          type: "animation",
          name,
          timestamp: Date.now(),
          sizeBytes: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          detail: message,
        });
        pushToast("error", err instanceof BadgeStorageError ? err.message : `Failed to upload animation "${name}"`);
        return false;
      } finally {
        setActiveTransfer(null);
      }
    },
    [connectionState, pushToast, recordTransfer],
  );

  const sendFrame = useCallback(
    async (dataUrl: string, name: string) => {
      const client = clientRef.current;
      if (connectionState !== "connected" || !client) {
        pushToast("error", "Connect to a badge first");
        return;
      }
      const startedAt = Date.now();
      setActiveTransfer({ label: `Testing frame on badge`, percent: 0 });
      const onProgress: ProgressHandler = (progress) => {
        setActiveTransfer({ label: `Testing frame on badge`, percent: progress.percent });
      };
      try {
        const bytes = await client.sendFrame(dataUrl, onProgress);
        recordTransfer({
          id: crypto.randomUUID(),
          type: "frame",
          name,
          timestamp: Date.now(),
          sizeBytes: bytes,
          durationMs: Date.now() - startedAt,
          success: true,
        });
        pushToast("success", "Frame flashed to badge");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        recordTransfer({
          id: crypto.randomUUID(),
          type: "frame",
          name,
          timestamp: Date.now(),
          sizeBytes: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          detail: message,
        });
        pushToast("error", "Failed to flash frame to badge");
        appendLog("error", "Live frame write failed", message);
      } finally {
        setActiveTransfer(null);
      }
    },
    [appendLog, connectionState, pushToast, recordTransfer],
  );

  const addCustomFace = useCallback((face: CustomFace) => {
    setCustomFaces((prev) => {
      const next = [face, ...prev];
      saveCustomFaces(next);
      return next;
    });
  }, []);

  const removeCustomFace = useCallback((id: string) => {
    setCustomFaces((prev) => {
      const next = prev.filter((f) => f.id !== id);
      saveCustomFaces(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const value = useMemo<BadgeContextValue>(
    () => ({
      connectionState,
      transport,
      isSimulated,
      badgeInfo,
      logs,
      history,
      customFaces,
      brightness,
      toasts,
      activeTransfer,
      connect,
      connectDemo,
      disconnect,
      setBrightness,
      commitBrightness,
      sendFace,
      sendAnimation,
      sendFrame,
      addCustomFace,
      removeCustomFace,
      clearHistory,
      clearLogs,
      dismissToast,
      pushToast,
    }),
    [
      connectionState,
      transport,
      isSimulated,
      badgeInfo,
      logs,
      history,
      customFaces,
      brightness,
      toasts,
      activeTransfer,
      connect,
      connectDemo,
      disconnect,
      setBrightness,
      commitBrightness,
      sendFace,
      sendAnimation,
      sendFrame,
      addCustomFace,
      removeCustomFace,
      clearHistory,
      clearLogs,
      dismissToast,
      pushToast,
    ],
  );

  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}

export function useBadge(): BadgeContextValue {
  const ctx = useContext(BadgeContext);
  if (!ctx) throw new Error("useBadge must be used within a BadgeProvider");
  return ctx;
}
