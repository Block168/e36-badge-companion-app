import { useMemo, useState, type ReactNode } from "react";
import { Gauge, Send, Trash2 } from "lucide-react";
import { PRESET_FACES } from "../data/presetFaces";
import { renderPresetFaceDataUrl } from "../lib/presetRender";
import { useBadge } from "../context/BadgeContext";
import { BadgePreview } from "./BadgePreview";
import { FaceUploader } from "./FaceUploader";
import { speedGaugeDataUrl } from "./LiveGauge";import { useGeoSpeed } from "../lib/liveSpeed";
import { cn } from "../utils/cn";
import type { PresetFace } from "../types";

type GalleryItem =
  | { kind: "preset"; id: string; name: string; description: string; accent: string; dataUrl: string; category: string }
  | { kind: "custom"; id: string; name: string; dataUrl: string }
  | { kind: "live"; id: string; name: string };

type CategoryFilter = "all" | "motorsport" | "utility" | "minimal";

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "motorsport", label: "Motorsport" },
  { id: "utility", label: "Utility" },
  { id: "minimal", label: "Minimal" },
];

const LIVE_ITEM: GalleryItem = { kind: "live", id: "live-speed", name: "Live Speed Gauge" };

export function FaceGallery() {
  const { connectionState, brightness, customFaces, sendFace, removeCustomFace } = useBadge();
  const { kmh, active, simulated } = useGeoSpeed(450);
  const connected = connectionState === "connected";

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string>(LIVE_ITEM.id);

  const presetItems: GalleryItem[] = useMemo(
    () =>
      PRESET_FACES.map((face: PresetFace) => ({
        kind: "preset" as const,
        id: face.id,
        name: face.name,
        description: face.description,
        accent: face.accent,
        category: face.category,
        dataUrl: renderPresetFaceDataUrl(face),
      })),
    [],
  );

  const customItems: GalleryItem[] = customFaces.map((face) => ({
    kind: "custom" as const,
    id: face.id,
    name: face.name,
    dataUrl: face.dataUrl,
  }));

  const filteredPresets = category === "all" ? presetItems : presetItems.filter((p) => p.kind === "preset" && p.category === category);
  const allItems: GalleryItem[] = [LIVE_ITEM, ...customItems, ...filteredPresets];
  const selected = allItems.find((item) => item.id === selectedId) ?? allItems[0] ?? null;

  const previewDataUrl = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "live") return speedGaugeDataUrl(kmh, simulated);
    return selected.dataUrl;
  }, [selected, kmh, simulated]);

  const handleSend = () => {
    if (!connected || !selected) return;
    if (selected.kind === "live") {
      sendFace(speedGaugeDataUrl(kmh, simulated), `Live Speed · ${Math.round(kmh)} km/h`);
    } else {
      sendFace(selected.dataUrl, selected.name);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div className="space-y-6">
        <div className="card-track p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-200">
            Upload a custom face
          </h3>
          <p className="mb-4 mt-1 text-xs text-zinc-500">
            Images are automatically cropped and scaled to the badge's native 480×480 resolution.
          </p>
          <FaceUploader />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-widest text-zinc-500">Garage:</span>
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setCategory(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider transition",
                category === f.id
                  ? "bg-gradient-to-b from-m-blue-500 to-m-blue-700 text-white shadow"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div>
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-zinc-200">Live</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FaceCard
              item={LIVE_ITEM}
              selected={selected?.id === LIVE_ITEM.id}
              onSelect={() => setSelectedId(LIVE_ITEM.id)}
              liveContent={
                <div className="relative flex h-full w-full items-center justify-center bg-black">
                  <img src={speedGaugeDataUrl(kmh, simulated)} alt="Live speed gauge" className="h-full w-full object-cover" draggable={false} />
                  <span
                    className={cn(
                      "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest",
                      active
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-m-red-500/40 bg-m-red-500/15 text-m-red-300",
                    )}
                  >
                    <Gauge className="h-2.5 w-2.5" />
                    {simulated ? "Demo" : "GPS"}
                  </span>
                </div>
              }
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-zinc-200">
            Preset Faces
          </h3>
          {filteredPresets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
              No presets in this category.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {filteredPresets.map((item) => (
                <FaceCard
                  key={item.id}
                  item={item}
                  selected={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {customItems.length > 0 && (
          <div>
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-zinc-200">
              Your Uploads
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {customItems.map((item) => (
                <FaceCard
                  key={item.id}
                  item={item}
                  selected={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onDelete={() => {
                    removeCustomFace(item.id);
                    if (selectedId === item.id) setSelectedId(LIVE_ITEM.id);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="card-track h-fit space-y-4 p-5 lg:sticky lg:top-20">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-200">Live Preview</h3>
        <BadgePreview
          faceUrl={previewDataUrl}
          brightness={connected ? brightness : 45}
          connected={connected}
          size={440}
          className="mx-auto"
        />
        {selected && (
          <div className="text-center">
            <p className="font-display font-bold uppercase tracking-wide text-white">{selected.name}</p>
            {selected.kind === "preset" && selected.description && (
              <p className="mt-1 text-xs text-zinc-500">{selected.description}</p>
            )}
            {selected.kind === "live" && (
              <p className="mt-1 text-xs text-zinc-500">
                {active ? `Reading real GPS ground speed — ${Math.round(kmh)} km/h.` : "GPS unavailable — demo speed shown."}{" "}
                Sends a static snapshot of the needle.
              </p>
            )}
          </div>
        )}
        <button
          disabled={!connected || !selected}
          onClick={handleSend}
          className="btn-primary w-full"
        >
          <Send className="h-4 w-4" />
          Send to Badge
        </button>
        {!connected && <p className="text-center text-xs text-amber-400/80">Connect a badge to enable transfers.</p>}
      </aside>
    </div>
  );
}

function FaceCard({
  item,
  selected,
  onSelect,
  onDelete,
  liveContent,
}: {
  item: GalleryItem;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  liveContent?: ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-zinc-900 text-left transition",
        selected ? "border-m-blue-500 ring-2 ring-m-blue-500/40" : "border-zinc-800 hover:border-zinc-600",
      )}
    >
      <div className="aspect-square w-full overflow-hidden rounded-full bg-black">
        {liveContent ?? <img src={item.kind === "live" ? "" : item.dataUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-zinc-200">{item.name}</p>
        {item.kind === "custom" && <p className="text-[10px] text-zinc-500">Custom upload</p>}
        {item.kind === "live" && <p className="text-[10px] text-zinc-500">Live GPS gauge</p>}
      </div>
      {item.kind === "custom" && onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              onDelete();
            }
          }}
          className="absolute right-1.5 top-1.5 rounded-lg bg-black/70 p-1.5 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-m-red-600/80"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-300" />
        </span>
      )}
      {!onDelete && item.kind === "preset" && (
        <span
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/40"
          style={{ backgroundColor: item.accent }}
        />
      )}
      {selected && (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-gradient-to-b from-m-blue-500 to-m-blue-700 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide text-white">
          Selected
        </span>
      )}
    </button>
  );
}
