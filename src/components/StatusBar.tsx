import { Bluetooth, BluetoothConnected, BluetoothOff, Loader2 } from "lucide-react";
import type { ConnectionState } from "../types";
import { cn } from "../utils/cn";

const STATE_META: Record<ConnectionState, { label: string; tone: string }> = {
  poweredOff: { label: "Bluetooth Off", tone: "text-zinc-400 bg-zinc-800" },
  unauthorized: { label: "Not Authorized", tone: "text-red-300 bg-red-950" },
  idle: { label: "Not Connected", tone: "text-zinc-300 bg-zinc-800" },
  scanning: { label: "Scanning…", tone: "text-amber-300 bg-amber-950" },
  connecting: { label: "Connecting…", tone: "text-amber-300 bg-amber-950" },
  discoveringServices: { label: "Discovering…", tone: "text-amber-300 bg-amber-950" },
  ready: { label: "Connected", tone: "text-emerald-300 bg-emerald-950" },
  disconnected: { label: "Disconnected", tone: "text-red-300 bg-red-950" },
};

export function StatusPill({ state, rssi, name }: { state: ConnectionState; rssi?: number; name?: string }) {
  const meta = STATE_META[state];
  const isBusy = state === "scanning" || state === "connecting" || state === "discoveringServices";
  const Icon = state === "poweredOff" ? BluetoothOff : state === "ready" ? BluetoothConnected : Bluetooth;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ring-white/5",
        meta.tone
      )}
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      <span>{meta.label}</span>
      {state === "ready" && name && (
        <span className="hidden text-zinc-400 sm:inline">· {name}</span>
      )}
      {state === "ready" && typeof rssi === "number" && (
        <span className="text-zinc-500">{rssi} dBm</span>
      )}
    </div>
  );
}
