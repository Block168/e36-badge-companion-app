import { useMemo, useState } from "react";
import { Check, Film, Gauge, ImagePlus, ListPlus, Loader2, Play, Plus, Trash2, WandSparkles } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { useAutomation, type LibraryItem } from "../context/AutomationContext";
import { useFaceUpload } from "./FaceUploader";
import { AnimationEditor } from "./AnimationEditor";
import { BadgePreview } from "./BadgePreview";
import { EmptyState, Row, RowIcon, ScreenHeader, Section, Segmented, Sheet } from "./ui";
import { cn } from "../utils/cn";

type Filter = "all" | "faces" | "animations";

const STUDIO_KEY = "e36.studioOpen";

const KIND_LABEL: Record<LibraryItem["kind"], string> = {
  preset: "Preset face",
  custom: "Your face",
  animation: "Animation",
  live: "Live gauge",
};

function describe(item: LibraryItem): string {
  if (item.kind === "animation") return `${item.meta.frameCount} frames · ${(item.meta.totalMs / 1000).toFixed(1)}s`;
  if (item.kind === "preset") return item.preset.description;
  if (item.kind === "live") return "Sends a snapshot of your GPS speed";
  return KIND_LABEL[item.kind];
}

function Tile({ item, playing, onOpen }: { item: LibraryItem; playing: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl p-1 text-center transition active:scale-[0.96]">
      <span className="relative block w-full">
        <img
          src={item.thumb}
          alt=""
          draggable={false}
          loading="lazy"
          className={cn(
            "aspect-square w-full rounded-full bg-surface object-cover ring-1 ring-white/10 transition duration-150 group-hover:ring-white/30",
            playing && "ring-[3px] ring-go group-hover:ring-go",
          )}
        />
        {item.kind === "animation" && (
          <span className="absolute right-[6%] bottom-[6%] flex h-6 w-6 items-center justify-center rounded-full bg-black/80 ring-1 ring-white/20">
            <Film className="h-3 w-3" />
          </span>
        )}
        {item.kind === "live" && (
          <span className="absolute right-[6%] bottom-[6%] flex h-6 w-6 items-center justify-center rounded-full bg-black/80 ring-1 ring-white/20">
            <Gauge className="h-3 w-3 text-warn" />
          </span>
        )}
      </span>
      <span className="w-full truncate text-[13px] font-medium text-label">{item.name}</span>
    </button>
  );
}

function Grid({ items, nowPlayingId, onOpen }: { items: LibraryItem[]; nowPlayingId?: string; onOpen: (item: LibraryItem) => void }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
      {items.map((item) => (
        <Tile key={item.id} item={item} playing={item.id === nowPlayingId} onOpen={() => onOpen(item)} />
      ))}
    </div>
  );
}

function ItemSheet({ item, onClose }: { item: LibraryItem | null; onClose: () => void }) {
  const { connectionState, brightness, removeCustomFace } = useBadge();
  const { playItem, playlists, createPlaylist, updatePlaylist, deleteAnimation, nowPlaying, speed } = useAutomation();
  const connected = connectionState === "connected";
  const [pickingPlaylist, setPickingPlaylist] = useState(false);

  const close = () => {
    setPickingPlaylist(false);
    onClose();
  };
  if (!item) return null;

  const addTo = (playlistId: string) => {
    const p = playlists.find((x) => x.id === playlistId);
    if (p && !p.itemIds.includes(item.id)) updatePlaylist({ ...p, itemIds: [...p.itemIds, item.id] });
    close();
  };

  const remove = async () => {
    if (item.kind === "custom") removeCustomFace(item.id.slice("custom:".length));
    if (item.kind === "animation") await deleteAnimation(item.meta.id);
    close();
  };

  return (
    <Sheet open onClose={close} title={pickingPlaylist ? "Add to Playlist" : undefined}>
      {pickingPlaylist ? (
        <Section footer="Playlists play from your phone while the app is open.">
          {playlists.map((p) => (
            <Row
              key={p.id}
              title={p.name}
              subtitle={`${p.itemIds.length} items`}
              accessory={p.itemIds.includes(item.id) ? <Check className="h-5 w-5 text-go" /> : undefined}
              onClick={() => addTo(p.id)}
            />
          ))}
          <Row
            icon={
              <RowIcon color="bg-surface-3">
                <Plus className="h-4 w-4" />
              </RowIcon>
            }
            title="New Playlist"
            onClick={() => addTo(createPlaylist(`Playlist ${playlists.length + 1}`).id)}
          />
        </Section>
      ) : (
        <div className="pt-2">
          <div className="mb-5 flex justify-center">
            <BadgePreview
              faceUrl={item.kind === "live" ? item.thumb : item.kind === "animation" ? item.thumb : item.dataUrl}
              brightness={connected ? brightness : 80}
              size={200}
              className="w-full max-w-[200px]"
            />
          </div>
          <p className="text-center text-[22px] leading-tight font-bold">{item.name}</p>
          <p className="mt-1 text-center text-[15px] text-label-2">
            {item.kind === "live" && speed.live ? `${Math.round(speed.kmh)} km/h right now` : describe(item)}
          </p>
          {nowPlaying?.itemId === item.id && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] font-medium text-go">
              <span className="h-2 w-2 rounded-full bg-go" />
              Playing now
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={async () => {
                if (await playItem(item.id)) close();
              }}
              disabled={!connected}
              className="btn-primary w-full"
            >
              <Play className="h-5 w-5 fill-current" />
              Play on Badge
            </button>
            {!connected && <p className="text-center text-[13px] text-warn">Connect a badge in Garage to play.</p>}
            <button onClick={() => setPickingPlaylist(true)} className="btn-secondary w-full">
              <ListPlus className="h-5 w-5" />
              Add to Playlist
            </button>
            {(item.kind === "custom" || item.kind === "animation") && (
              <button onClick={() => void remove()} className="btn-danger w-full">
                <Trash2 className="h-5 w-5" />
                Delete from Library
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function LibraryScreen() {
  const { items, nowPlaying } = useAutomation();
  const upload = useFaceUpload();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [studio, setStudioState] = useState(() => localStorage.getItem(STUDIO_KEY) === "1");
  const setStudio = (open: boolean) => {
    setStudioState(open);
    try {
      localStorage.setItem(STUDIO_KEY, open ? "1" : "0");
    } catch {
      // Not critical — only restores the Studio after a reload.
    }
    window.scrollTo({ top: 0 });
  };
  const [dragOver, setDragOver] = useState(false);

  const groups = useMemo(() => {
    const live = items.filter((i) => i.kind === "live");
    const anims = items.filter((i) => i.kind === "animation");
    const mine = items.filter((i) => i.kind === "custom");
    const presets = items.filter((i) => i.kind === "preset");
    return { live, anims, mine, presets };
  }, [items]);

  // Keep the sheet in sync if the item changes or disappears (e.g. deleted).
  const openItem = open ? (items.find((i) => i.id === open.id) ?? null) : null;

  if (studio) {
    return (
      <>
        {upload.input}
        <AnimationEditor onBack={() => setStudio(false)} />
      </>
    );
  }

  const showFaces = filter !== "animations";
  const showAnims = filter !== "faces";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload.handleFile(file);
      }}
      className={cn("rounded-3xl transition", dragOver && "bg-surface/60 ring-2 ring-link ring-inset")}
    >
      {upload.input}
      <ScreenHeader
        title="Library"
        actions={
          <button onClick={() => setAdding(true)} className="btn-icon" aria-label="Add to Library">
            {upload.processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={2.4} />}
          </button>
        }
      />

      <Segmented
        value={filter}
        onChange={setFilter}
        className="mb-6"
        options={[
          { id: "all", label: "All" },
          { id: "faces", label: "Faces" },
          { id: "animations", label: "Animations" },
        ]}
      />

      {showAnims && (
        <section className="mb-8">
          <div className="section-header">
            <span>Your Animations</span>
            <button onClick={() => setStudio(true)} className="link-btn min-h-0 text-[15px] normal-case">
              New Animation
            </button>
          </div>
          {groups.anims.length === 0 ? (
            <div className="list-group">
              <EmptyState
                icon={<WandSparkles className="h-6 w-6" />}
                title="No animations yet"
                body="Build one from your faces and effects in the Studio."
                action={
                  <button onClick={() => setStudio(true)} className="btn-secondary">
                    Open Studio
                  </button>
                }
              />
            </div>
          ) : (
            <Grid items={groups.anims} nowPlayingId={nowPlaying?.itemId} onOpen={setOpen} />
          )}
        </section>
      )}

      {showFaces && (
        <>
          <section className="mb-8">
            <div className="section-header">
              <span>Live</span>
            </div>
            <Grid items={groups.live} nowPlayingId={nowPlaying?.itemId} onOpen={setOpen} />
          </section>

          {groups.mine.length > 0 && (
            <section className="mb-8">
              <div className="section-header">
                <span>Your Faces</span>
                <button onClick={upload.pick} className="link-btn min-h-0 text-[15px] normal-case">
                  Upload
                </button>
              </div>
              <Grid items={groups.mine} nowPlayingId={nowPlaying?.itemId} onOpen={setOpen} />
            </section>
          )}

          <section className="mb-8">
            <div className="section-header">
              <span>Presets</span>
            </div>
            <Grid items={groups.presets} nowPlayingId={nowPlaying?.itemId} onOpen={setOpen} />
          </section>
        </>
      )}

      <ItemSheet item={openItem} onClose={() => setOpen(null)} />

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add to Library">
        <Section footer="Photos are cropped and scaled to the badge's round 480×480 display. On a computer you can also drop an image onto this page.">
          <Row
            icon={
              <RowIcon color="bg-link">
                <ImagePlus className="h-4 w-4" />
              </RowIcon>
            }
            title="Upload a Face"
            subtitle="From photos or files"
            chevron
            onClick={() => {
              setAdding(false);
              upload.pick();
            }}
          />
          <Row
            icon={
              <RowIcon color="bg-danger">
                <WandSparkles className="h-4 w-4" />
              </RowIcon>
            }
            title="New Animation"
            subtitle="Frames, effects and timing in the Studio"
            chevron
            onClick={() => {
              setAdding(false);
              setStudio(true);
            }}
          />
        </Section>
      </Sheet>
    </div>
  );
}
