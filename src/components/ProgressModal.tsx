import { useBadge } from "../context/BadgeContext";

export function ProgressModal() {
  const { activeTransfer } = useBadge();
  // Automation sends show as a thin bar on the tab bar instead.
  if (!activeTransfer || activeTransfer.background) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeTransfer.label}
      className="anim-fade fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:px-4"
    >
      <div className="anim-sheet w-full max-w-sm rounded-t-[16px] bg-surface p-6 pb-[calc(var(--safe-bottom)+24px)] sm:rounded-[16px] sm:pb-6">
        <p className="text-[13px] text-label-2 uppercase">Transferring</p>
        <p className="mt-1 truncate text-[17px] font-semibold">{activeTransfer.label}</p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-label transition-[width] duration-150" style={{ width: `${activeTransfer.percent}%` }} />
        </div>
        <p className="mt-2 text-right text-[13px] text-label-2 tabular-nums">{activeTransfer.percent}%</p>
      </div>
    </div>
  );
}
