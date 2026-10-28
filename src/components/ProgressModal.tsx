import { Loader2 } from "lucide-react";
import { useBadge } from "../context/BadgeContext";

export function ProgressModal() {
  const { activeTransfer } = useBadge();
  if (!activeTransfer) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeTransfer.label}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-4"
    >
      <div className="carbon-soft w-full max-w-sm rounded-t-2xl border border-zinc-800 p-6 pb-[calc(var(--safe-bottom)+24px)] shadow-2xl sm:rounded-2xl sm:pb-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-m-blue-400" />
          <p className="font-display text-sm font-bold uppercase tracking-wide text-zinc-200">
            {activeTransfer.label}
          </p>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-m-blue-500 to-cyan-400 transition-all duration-150"
            style={{ width: `${activeTransfer.percent}%` }}
          />
        </div>
        <p className="mt-2 text-right font-display text-xs font-bold tabular-nums text-zinc-500">
          {String(activeTransfer.percent).padStart(3, "0")}%
        </p>
      </div>
    </div>
  );
}
