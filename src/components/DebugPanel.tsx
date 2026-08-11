import { useEffect, useRef, useState } from "react";
import { Bug, Radio, Trash2 } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";
import type { LogLevel } from "../types";
import { CHARACTERISTIC_LABELS, E36_SERVICE_UUID } from "../lib/protocol";

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "text-sky-300",
  success: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-red-300",
  gatt: "text-violet-300",
};

export function DebugPanel() {
  const { logs, clearLogs, connectionState, isSimulated } = useBadge();
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

  const levels: (LogLevel | "all")[] = ["all", "info", "gatt", "success", "warn", "error"];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div className="card-track p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-violet-400" />
            <h3 className="font-display text-lg font-bold uppercase tracking-widest text-white">
              GATT Debug Console
            </h3>
          </div>
          <button
            onClick={clearLogs}
            className="chip border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-red-800 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear Logs
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={cn(
                "rounded-lg px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider transition",
                filter === l ? "bg-violet-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div
          ref={scrollRef}
          className="mt-4 h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-black/60 p-3 font-mono text-xs leading-relaxed"
        >
          {filteredLogs.length === 0 ? (
            <p className="text-zinc-600">No logs yet. Connect to a badge to see live GATT activity.</p>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-2 py-0.5">
                <span className="shrink-0 text-zinc-600">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className={cn("shrink-0 font-semibold uppercase", LEVEL_STYLES[log.level])}>
                  [{log.level}]
                </span>
                <span className="text-zinc-300">{log.message}</span>
                {log.detail && <span className="text-zinc-600">— {log.detail}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <aside className="card-track h-fit space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-400" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-200">
            GATT Inspector
          </h3>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-zinc-500">Connection</p>
          <p className="font-mono text-zinc-300">{connectionState}{isSimulated ? " (simulated)" : ""}</p>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-zinc-500">Primary Service</p>
          <p className="break-all font-mono text-[11px] text-zinc-400">{E36_SERVICE_UUID}</p>
        </div>
        <div className="space-y-2 text-xs">
          <p className="text-zinc-500">Characteristics</p>
          <div className="space-y-2">
            {Object.entries(CHARACTERISTIC_LABELS).map(([uuid, label]) => (
              <div key={uuid} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                <p className="font-semibold text-zinc-300">{label}</p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-600">{uuid}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
