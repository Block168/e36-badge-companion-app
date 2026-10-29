import { useEffect, useRef, useState } from "react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";
import type { LogLevel } from "../types";
import { CHARACTERISTIC_LABELS, E36_SERVICE_UUID } from "../lib/protocol";
import { NavBar, Row, Section } from "./ui";

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "text-link",
  success: "text-go",
  warn: "text-warn",
  error: "text-danger",
  gatt: "text-[#bf5af2]",
};

const LEVELS: (LogLevel | "all")[] = ["all", "info", "gatt", "success", "warn", "error"];

export function DebugPanel({ onBack }: { onBack: () => void }) {
  const { logs, clearLogs, connectionState, isSimulated } = useBadge();
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredLogs.length]);

  return (
    <div className="anim-push">
      <NavBar
        back="Settings"
        onBack={onBack}
        title="Debug Console"
        trailing={
          <button onClick={clearLogs} className="link-btn text-danger">
            Clear
          </button>
        }
      />

      <div className="scroll-strip mb-4">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setFilter(l)}
            aria-pressed={filter === l}
            className={cn(
              "min-h-9 rounded-full px-4 text-[13px] font-semibold capitalize transition active:scale-95",
              filter === l ? "bg-label text-black" : "bg-fill text-label-2",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="mb-8 h-[55vh] overflow-y-auto overscroll-contain rounded-xl bg-surface p-3 font-mono text-[11px] leading-relaxed sm:text-xs"
      >
        {filteredLogs.length === 0 ? (
          <p className="text-label-3">No logs yet. Connect to a badge to see live GATT activity.</p>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap gap-x-2 py-0.5">
              <span className="shrink-0 text-label-3">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
              <span className={cn("shrink-0 font-semibold uppercase", LEVEL_STYLES[log.level])}>[{log.level}]</span>
              <span className="min-w-0 break-words text-label">{log.message}</span>
              {log.detail && <span className="min-w-0 break-all text-label-3">— {log.detail}</span>}
            </div>
          ))
        )}
      </div>

      <Section title="GATT Inspector">
        <Row title="Connection" detail={`${connectionState}${isSimulated ? " (simulated)" : ""}`} />
        <Row title="Primary service" subtitle={<span className="font-mono break-all whitespace-normal">{E36_SERVICE_UUID}</span>} />
        {Object.entries(CHARACTERISTIC_LABELS).map(([uuid, label]) => (
          <Row key={uuid} title={label} subtitle={<span className="font-mono break-all whitespace-normal">{uuid}</span>} />
        ))}
      </Section>
    </div>
  );
}
