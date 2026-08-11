import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Film, Image as ImageIcon, SunMedium, Trash2, XCircle, Zap } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { formatBytes } from "../lib/imageEncode";
import { cn } from "../utils/cn";
import type { TransferRecord } from "../types";

const TYPE_META: Record<TransferRecord["type"], { label: string; icon: typeof ImageIcon }> = {
  face: { label: "Face", icon: ImageIcon },
  animation: { label: "Animation", icon: Film },
  brightness: { label: "Brightness", icon: SunMedium },
  frame: { label: "Live Frame", icon: Zap },
};

type FilterType = "all" | TransferRecord["type"];

export function HistoryPanel() {
  const { history, clearHistory } = useBadge();
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = useMemo(
    () => (filter === "all" ? history : history.filter((h) => h.type === filter)),
    [history, filter],
  );

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "face", label: "Faces" },
    { id: "animation", label: "Animations" },
    { id: "brightness", label: "Brightness" },
    { id: "frame", label: "Live Frames" },
  ];

  return (
    <div className="card-track p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold uppercase tracking-widest text-white">Transfer History</h3>
          <p className="mt-0.5 text-sm text-zinc-500">{history.length} total transfers logged on this device.</p>
        </div>
        <button
          onClick={clearHistory}
          disabled={history.length === 0}
          className="chip border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-red-800 hover:text-red-300 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider transition",
              filter === f.id
                ? "bg-gradient-to-b from-m-blue-500 to-m-blue-700 text-white shadow"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            No transfers yet. Send a face, animation, or brightness change to see it here.
          </p>
        ) : (
          filtered.map((record) => {
            const meta = TYPE_META[record.type];
            const Icon = meta.icon;
            return (
              <div
                key={record.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    record.success ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400",
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{record.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" /> {new Date(record.timestamp).toLocaleString()}
                    </span>
                    <span>{meta.label}</span>
                    {record.sizeBytes > 0 && <span>{formatBytes(record.sizeBytes)}</span>}
                    <span>{record.durationMs}ms</span>
                    {record.detail && <span>{record.detail}</span>}
                  </div>
                </div>
                {record.success ? (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="h-4.5 w-4.5 shrink-0 text-red-400" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
