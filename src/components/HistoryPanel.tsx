import { useMemo, useState } from "react";
import { Film, Image as ImageIcon, SunMedium, Zap } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { formatBytes } from "../lib/imageEncode";
import { EmptyState, NavBar, Row, RowIcon, Section, Segmented } from "./ui";
import type { TransferRecord } from "../types";

const TYPE_META: Record<TransferRecord["type"], { label: string; icon: typeof ImageIcon; color: string }> = {
  face: { label: "Face", icon: ImageIcon, color: "bg-link" },
  animation: { label: "Animation", icon: Film, color: "bg-danger" },
  brightness: { label: "Brightness", icon: SunMedium, color: "bg-warn" },
  frame: { label: "Live Frame", icon: Zap, color: "bg-go" },
};

type FilterType = "all" | TransferRecord["type"];

export function HistoryPanel({ onBack }: { onBack: () => void }) {
  const { history, clearHistory } = useBadge();
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => (filter === "all" ? history : history.filter((h) => h.type === filter)), [history, filter]);

  return (
    <div className="anim-push">
      <NavBar
        back="Settings"
        onBack={onBack}
        title="Transfer History"
        trailing={
          <button onClick={clearHistory} disabled={history.length === 0} className="link-btn text-danger">
            Clear
          </button>
        }
      />

      <Segmented
        className="mb-6"
        value={filter}
        onChange={setFilter}
        options={[
          { id: "all", label: "All" },
          { id: "face", label: "Faces" },
          { id: "animation", label: "Anims" },
          { id: "brightness", label: "Light" },
        ]}
      />

      {filtered.length === 0 ? (
        <div className="list-group">
          <EmptyState icon={<Film className="h-6 w-6" />} title="Nothing here yet" body="Faces, animations and brightness changes you send show up here." />
        </div>
      ) : (
        <Section footer={`${history.length} transfers logged on this device.`}>
          {filtered.map((record) => {
            const meta = TYPE_META[record.type];
            const Icon = meta.icon;
            const when = new Date(record.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
            const extra = [record.sizeBytes > 0 && formatBytes(record.sizeBytes), `${record.durationMs}ms`, record.detail].filter(Boolean).join(" · ");
            return (
              <Row
                key={record.id}
                icon={
                  <RowIcon color={record.success ? meta.color : "bg-surface-3"}>
                    <Icon className="h-4 w-4" />
                  </RowIcon>
                }
                title={record.name}
                subtitle={`${when} · ${extra}`}
                detail={record.success ? undefined : <span className="text-danger">Failed</span>}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}
