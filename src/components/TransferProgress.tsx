import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { TransferProgress as TransferProgressT } from "../types";

const PHASE_LABEL: Record<TransferProgressT["phase"], string> = {
  idle: "Idle",
  preparing: "Preparing…",
  converting: "Converting image…",
  uploading: "Uploading…",
  "ack-wait": "Waiting…",
  complete: "Transfer complete",
  error: "Transfer failed",
  cancelled: "Transfer cancelled",
};

export function TransferProgressBar({ transfer, onCancel }: { transfer: TransferProgressT; onCancel?: () => void }) {
  if (transfer.phase === "idle") return null;
  const pct = transfer.totalBytes > 0 ? Math.min(100, Math.round((transfer.bytesSent / transfer.totalBytes) * 100)) : 0;
  const isDone = transfer.phase === "complete";
  const isError = transfer.phase === "error" || transfer.phase === "cancelled";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-zinc-200">
          {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          {isError && <XCircle className="h-4 w-4 text-red-400" />}
          {!isDone && !isError && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
          <span>{PHASE_LABEL[transfer.phase]}</span>
        </div>
        {typeof transfer.totalFrames === "number" && transfer.totalFrames > 1 && (
          <span className="text-zinc-500">
            frame {(transfer.frameIndex ?? 0) + 1}/{transfer.totalFrames}
          </span>
        )}
      </div>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-150 ${
            isError ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          chunk {transfer.chunkIndex}/{transfer.totalChunks} · {(transfer.bytesSent / 1024).toFixed(1)}KB /{" "}
          {(transfer.totalBytes / 1024).toFixed(1)}KB
        </span>
        <span>{pct}%</span>
      </div>

      {transfer.error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-950/60 p-2 text-[11px] text-red-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{transfer.error} — it will resume once reconnected.</span>
        </div>
      )}

      {!isDone && !isError && onCancel && (
        <button onClick={onCancel} className="mt-3 w-full rounded-lg border border-zinc-700 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800">
          Cancel Transfer
        </button>
      )}
    </div>
  );
}
