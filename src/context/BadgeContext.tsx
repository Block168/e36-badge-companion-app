import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BadgeBleClient, type ProgressHandler } from "../lib/bleClient";
import { BadgeWifiClient } from "../lib/wifiClient";
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

type Transport = "wifi" | "ble" | "demo";

interface BadgeContextValue {
  connectionState: ConnectionState;
  bleSupported: boolean;
  wifiSupported: boolean;
  transport: Transport | null;
  isSimulated: boolean;
  badgeInfo: BadgeInfo | null;
  logs: LogEntry[];
  history: TransferRecord[];
  customFaces: CustomFace[];
  brightness: number;
  toasts: ToastMessage[];
  activeTransfer: { label: string; percent: number } | null;
  connect: () => Promise<void>;
  connectWifi: () => Promise<void>;
  connectDemo: () => Promise<void>;
  disconnect: () => Promise<void>;
  setBrightness: (value: number) => void;
  commitBrightness: (value: number) => Promise<void>;
  sendFace: (dataUrl: string, name: string) => Promise<void>;
  sendAnimation: (frames: AnimationFrame[], name: string, opts?: { persist?: boolean }) => Promise<void>;
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
  const clientRef = useRef<BadgeBleClient | BadgeWifiClient | null>(null);
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
  const [activeTransfer, setActiveTransfer] = useState<{ label: string; percent: number } | null>(null);

  const wifiSupported = BadgeWifiClient.isSupported();
  const bleSupported = BadgeBleClient.isSupported();

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
    (kind: Transport): BadgeBleClient | BadgeWifiClient => {
      const client = kind === "wifi" ? new BadgeWifiClient() : new BadgeBleClient();
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
        // transient BLE read failures are fine to ignore
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
    if (!bleSupported) {
      pushToast("error", "Bluetooth isn't supported in this browser. Use WiFi or Demo Mode instead.");
      return;
    }
    const client = makeClient("ble");
    clientRef.current = client;
    setConnectionState("connecting");
    try {
      const info = await client.connect();
      setIsSimulated(false);
      setTransport("ble");
      finishConnect(info);
      startBatteryPolling();
      pushToast("success", `Connected to ${info.name} via Bluetooth`);
    } catch (err) {
      setConnectionState("error");
      const message = err instanceof Error ? err.message : String(err);
      if (message === "WEB_BLUETOOTH_UNSUPPORTED") {
        pushToast("error", "Web Bluetooth isn't supported in this browser. Use WiFi or Demo Mode instead.");
      } else if (message.toLowerCase().includes("cancelled") || message.toLowerCase().includes("user gesture")) {
        setConnectionState("disconnected");
      } else {
        pushToast("error", `Connection failed: ${message}`);
      }
      appendLog("error", "Connection attempt failed", message);
      setTimeout(() => setConnectionState((s) => (s === "error" ? "disconnected" : s)), 2200);
    }
  }, [appendLog, bleSupported, finishConnect, makeClient, pushToast, startBatteryPolling]);

  const connectWifi = useCallback(async () => {
    const client = makeClient("wifi");
    clientRef.current = client;
    setConnectionState("connecting");
    try {
      const info = await client.connect();
      setIsSimulated(false);
      setTransport("wifi");
      finishConnect(info);
      startBatteryPolling();
      pushToast("success", `Linked to ${info.name} over WiFi`);
    } catch (err) {
      setConnectionState("error");
      const message = err instanceof Error ? err.message : String(err);
      if (message === "TIMED_OUT") {
        pushToast(
          "error",
          "Couldn't reach the badge over WiFi. Make sure your phone is joined to the E36-Badge network, then try again.",
        );
      } else {
        pushToast("error", `WiFi connection failed: ${message}`);
      }
      appendLog("error", "WiFi connection attempt failed", message);
      setTimeout(() => setConnectionState((s) => (s === "error" ? "disconnected" : s)), 2200);
    }
  }, [appendLog, finishConnect, makeClient, pushToast, startBatteryPolling]);

  const connectDemo = useCallback(async () => {
    const client = makeClient("demo") as BadgeBleClient;
    clientRef.current = client;
    // Debug/test seam: lets a headless probe or the browser console inject
    // simulated BLE failures and inspect recovery stats.
    if (typeof window !== "undefined") {
      (window as unknown as { __badgeBleClient?: BadgeBleClient }).__badgeBleClient = client;
    }
    setConnectionState("connecting");
    try {
      const info = await client.connectSimulated();
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
      if (connectionState !== "connected" || !client) return;
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
      } catch (err) {
        pushToast("error", "Failed to update brightness");
        appendLog("error", "Brightness write failed", String(err));
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
    async (dataUrl: string, name: string) => {
      const client = clientRef.current;
      if (connectionState !== "connected" || !client) {
        pushToast("error", "Connect to a badge first");
        return;
      }
      const startedAt = Date.now();
      setActiveTransfer({ label: `Sending "${name}"`, percent: 0 });
      const onProgress: ProgressHandler = (progress) => {
        setActiveTransfer({ label: `Sending "${name}"`, percent: progress.percent });
      };
      try {
        const bytes = await client.sendFace(dataUrl, name, onProgress);
        await client.saveConfig({ active: "face" });
        recordTransfer({
          id: crypto.randomUUID(),
          type: "face",
          name,
          timestamp: Date.now(),
          sizeBytes: bytes,
          durationMs: Date.now() - startedAt,
          success: true,
        });
        pushToast("success", `"${name}" uploaded to badge`);
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
        pushToast("error", `Failed to send "${name}"`);
      } finally {
        setActiveTransfer(null);
      }
    },
    [connectionState, pushToast, recordTransfer],
  );

  const sendAnimation = useCallback(
    async (frames: AnimationFrame[], name: string, opts?: { persist?: boolean }) => {
      const client = clientRef.current;
      if (connectionState !== "connected" || !client) {
        pushToast("error", "Connect to a badge first");
        return;
      }
      if (frames.length === 0) {
        pushToast("error", "Add at least one frame first");
        return;
      }
      const startedAt = Date.now();
      setActiveTransfer({ label: `Uploading animation "${name}"`, percent: 0 });
      const onProgress: ProgressHandler = (progress) => {
        const frameLabel = progress.totalFrames ? ` (frame ${progress.frameIndex}/${progress.totalFrames})` : "";
        setActiveTransfer({ label: `Uploading animation "${name}"${frameLabel}`, percent: progress.percent });
      };
      try {
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
        pushToast("success", `Animation "${name}" uploaded`);
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
        pushToast("error", `Failed to upload animation "${name}"`);
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
      bleSupported,
      wifiSupported,
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
      connectWifi,
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
      bleSupported,
      wifiSupported,
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
      connectWifi,
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
