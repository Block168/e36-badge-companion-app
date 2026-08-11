import { BatteryMedium, Bluetooth, BluetoothConnected, Cpu, Gauge, HardDrive, PlugZap, Sparkles } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { BadgePreview } from "./BadgePreview";
import { LiveGauge } from "./LiveGauge";
import { useGeoSpeed } from "../lib/liveSpeed";
import { renderPresetFaceDataUrl } from "../lib/presetRender";
import { PRESET_FACES } from "../data/presetFaces";
import { cn } from "../utils/cn";

function BatteryMeter({ percent }: { percent: number }) {
  const cells = 10;
  const filled = Math.round((percent / 100) * cells);
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: cells }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 rounded-sm",
            i < filled ? (percent <= 20 ? "bg-m-red-500" : "bg-emerald-400") : "bg-zinc-800",
          )}
          style={{ height: `${8 + (i % 3) * 3}px` }}
        />
      ))}
    </div>
  );
}

export function ConnectionCard() {
  const { connectionState, isSupported, isSimulated, badgeInfo, brightness, connect, connectDemo, disconnect } =
    useBadge();
  const connected = connectionState === "connected";
  const connecting = connectionState === "connecting";
  const { kmh, active, simulated, error } = useGeoSpeed(600, connected);
  const previewFace = renderPresetFaceDataUrl(PRESET_FACES[0]);
  const usedPct = badgeInfo ? Math.round((badgeInfo.usedStorageKb / badgeInfo.totalStorageKb) * 100) : 0;

  return (
    <div className="card-track">
      <div className="m-stripe h-1 w-full opacity-70" />
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[auto,1fr]">
        <div className="flex flex-col items-center gap-5 lg:items-start">
          <BadgePreview
            faceUrl={connected ? previewFace : null}
            brightness={connected ? brightness : 0}
            connected={connected}
            scanning={!connected}
            size={190}
            label={connected ? "Badge display live" : connecting ? "Searching for devices…" : "Waiting to connect"}
          />
          {connected && (
            <div className="hidden w-full items-center gap-3 rounded-xl border border-zinc-800/70 bg-black/40 px-4 py-3 lg:flex">
              <Gauge className={cn("h-5 w-5 shrink-0", active ? "text-emerald-400" : "text-m-red-400")} />
              <div className="flex-1">
                <p className="font-display text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Ground speed
                </p>
                <p className="font-display text-2xl font-black tabular-nums text-white">
                  {String(Math.round(kmh)).padStart(3, "0")}
                  <span className="ml-1 text-xs font-bold text-zinc-500">km/h</span>
                </p>
              </div>
              <LiveGauge kmh={kmh} simulated={simulated} size={104} className="rounded-full" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest",
                connected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : connecting
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700/60 bg-zinc-900/60 text-zinc-500",
              )}
            >
              {connected ? (
                <BluetoothConnected className="h-3.5 w-3.5" />
              ) : connecting ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/60" />
                  <Bluetooth className="relative h-3.5 w-3.5" />
                </span>
              ) : (
                <Bluetooth className="h-3.5 w-3.5" />
              )}
              {connected ? "Connected" : connecting ? "Scanning…" : "Pit Lane"}
            </span>
            {isSimulated && connected && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest text-violet-300">
                <Sparkles className="h-3.5 w-3.5" /> Demo Mode
              </span>
            )}
            {connected && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest",
                  active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700/60 bg-zinc-900/60 text-zinc-500",
                )}
              >
                <Gauge className="h-3.5 w-3.5" />
                {simulated ? "GPS Demo" : active ? "GPS Live" : "GPS Off"}
              </span>
            )}
          </div>

          <div>
            <h2 className="font-display text-3xl font-black uppercase tracking-wide text-white">
              {badgeInfo?.name ?? "No badge in the garage"}
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-zinc-400">
              {connected
                ? "Your E36 badge is linked and ready for customization. Faces, brightness, and boot animations are a tap away."
                : "Connect via Bluetooth to manage faces, brightness, and animations — or spin up Demo Mode to try everything now."}
            </p>
          </div>

          {connected && badgeInfo && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-black/40 p-3.5">
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-semibold">Battery</span>
                  <BatteryMedium className="h-3.5 w-3.5" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="font-display text-xl font-bold tabular-nums text-white">{badgeInfo.batteryPercent}%</p>
                  <BatteryMeter percent={badgeInfo.batteryPercent} />
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/40 p-3.5">
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-semibold">Firmware</span>
                  <Cpu className="h-3.5 w-3.5" />
                </div>
                <p className="mt-2 font-display text-xl font-bold text-white">
                  v{badgeInfo.firmwareVersion}
                  <span className="ml-2 align-middle text-[11px] font-bold text-zinc-600">{badgeInfo.hardwareRevision}</span>
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/40 p-3.5">
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-semibold">Storage</span>
                  <HardDrive className="h-3.5 w-3.5" />
                </div>
                <p className="mt-2 font-display text-xl font-bold text-white">{usedPct}%</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      usedPct > 80 ? "bg-m-red-500" : "bg-gradient-to-r from-m-blue-500 to-cyan-400",
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            {!connected && (
              <>
                <button onClick={connect} disabled={connecting} className="btn-primary">
                  <PlugZap className="h-4 w-4" />
                  {isSupported ? "Connect Badge" : "Connect (unsupported)"}
                </button>
                <button onClick={connectDemo} disabled={connecting} className="btn-ghost">
                  <Sparkles className="h-4 w-4" />
                  Try Demo Mode
                </button>
              </>
            )}
            {connected && (
              <button onClick={disconnect} className="btn-danger">
                Disconnect
              </button>
            )}
          </div>

          {!isSupported && (
            <p className="max-w-md text-xs text-amber-400/90">
              Web Bluetooth isn't available in this browser. Use Chrome, Edge, or Opera on desktop/Android for real
              hardware — or explore every feature instantly with Demo Mode.
            </p>
          )}
          {error && (
            <p className="max-w-md text-xs text-zinc-500">
              GPS unavailable ({error}). Speed gauge running in demo mode.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
