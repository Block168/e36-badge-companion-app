import { Terminal, Trash2, Clock } from "lucide-react";
import type { BLEManagerApi } from "../hooks/useBLEManager";
import { useTransferHistory } from "../hooks/useTransferHistory";

const GATT_ROWS = [
  { name: "face_select", prop: "Write", desc: "Preset/custom face index (1 byte)" },
  { name: "image_data", prop: "Write, chunked", desc: "frame idx(1B)+total chunks(2B)+chunk idx(2B)+payload" },
  { name: "brightness", prop: "Read/Write", desc: "0–255, debounced writes" },
  { name: "boot_anim_flag", prop: "Write", desc: "Enable/disable custom boot sequence" },
  { name: "status", prop: "Notify", desc: "Transfer ack / progress / error codes" },
];

export function DebugPanel({ ble }: { ble: BLEManagerApi }) {
  const { history, clearHistory, deleteLog } = useTransferHistory();

  return (
    <div className="flex h-full flex-col px-5 py-6">
      <h2 className="text-lg font-semibold text-white">Developer / GATT</h2>
      <p className="text-xs text-zinc-500">Mock harness for development before hardware is ready.</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-2.5 py-2 font-medium">Characteristic</th>
              <th className="px-2.5 py-2 font-medium">Prop</th>
              <th className="px-2.5 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {GATT_ROWS.map((r) => (
              <tr key={r.name} className="text-zinc-300">
                <td className="px-2.5 py-2 font-mono text-blue-300">{r.name}</td>
                <td className="px-2.5 py-2 text-zinc-400">{r.prop}</td>
                <td className="px-2.5 py-2 text-zinc-500">{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Terminal className="h-3.5 w-3.5" /> Session Log
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800"
          >
            <Trash2 className="h-3 w-3" /> Clear History
          </button>
        )}
      </div>
      <div className="mt-2 flex-1 overflow-y-auto rounded-xl border border-zinc-800 bg-black/60 p-3 font-mono text-[10.5px] leading-relaxed text-emerald-300/90">
        {ble.log.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {l}
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Clock className="h-3.5 w-3.5" /> Transfer History
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-300">{log.faceName}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        log.status === "success"
                          ? "bg-emerald-950/60 text-emerald-400"
                          : log.status === "failed"
                          ? "bg-red-950/60 text-red-400"
                          : "bg-amber-950/60 text-amber-400"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-500">
                    {new Date(log.timestamp).toLocaleString()} · {(log.size / 1024).toFixed(1)}KB · {(log.duration / 1000).toFixed(2)}s
                  </div>
                </div>
                <button
                  onClick={() => deleteLog(log.id)}
                  className="ml-2 rounded p-1 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
