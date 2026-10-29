import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ListVideo, Play, Plus, Square, X } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { useAutomation } from "../context/AutomationContext";
import { EmptyState, NavBar, Row, ScreenHeader, Section, Segmented, Sheet, Thumb, Toggle } from "./ui";
import type { Playlist } from "../lib/library";

const INTERVALS = [
  { id: "10", label: "10s" },
  { id: "30", label: "30s" },
  { id: "60", label: "1m" },
  { id: "300", label: "5m" },
] as const;

function formatInterval(sec: number) {
  return sec >= 60 ? `${sec / 60} min` : `${sec}s`;
}

function PlayButton({ running, disabled, onToggle }: { running: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      aria-label={running ? "Stop playlist" : "Play playlist"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-label text-black transition active:scale-90 disabled:opacity-30"
    >
      {running ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
    </button>
  );
}

function AddItemsSheet({ playlist, open, onClose }: { playlist: Playlist; open: boolean; onClose: () => void }) {
  const { items, updatePlaylist } = useAutomation();
  const toggle = (id: string) => {
    const has = playlist.itemIds.includes(id);
    updatePlaylist({ ...playlist, itemIds: has ? playlist.itemIds.filter((x) => x !== id) : [...playlist.itemIds, id] });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add Items"
      trailing={
        <button onClick={onClose} className="link-btn font-semibold">
          Done
        </button>
      }
    >
      <Section>
        {items.map((item) => (
          <Row
            key={item.id}
            icon={<Thumb src={item.thumb} size={36} />}
            title={item.name}
            subtitle={item.kind === "animation" ? "Animation" : item.kind === "live" ? "Live gauge" : "Face"}
            accessory={playlist.itemIds.includes(item.id) ? <Check className="h-5 w-5 text-go" strokeWidth={2.6} /> : undefined}
            onClick={() => toggle(item.id)}
          />
        ))}
      </Section>
    </Sheet>
  );
}

function PlaylistDetail({ playlist, onBack }: { playlist: Playlist; onBack: () => void }) {
  const { connectionState } = useBadge();
  const { itemById, updatePlaylist, deletePlaylist, playlistRun, startPlaylist, stopPlaylist } = useAutomation();
  const [adding, setAdding] = useState(false);
  const connected = connectionState === "connected";
  const running = playlistRun?.playlistId === playlist.id;
  const entries = playlist.itemIds.map((id) => ({ id, item: itemById(id) })).filter((e) => e.item);

  const move = (from: number, to: number) => {
    const ids = [...playlist.itemIds];
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    updatePlaylist({ ...playlist, itemIds: ids });
  };

  return (
    <div className="anim-push">
      <NavBar back="Playlists" onBack={onBack} title={playlist.name} />

      <div className="mb-8">
        <input
          value={playlist.name}
          onChange={(e) => updatePlaylist({ ...playlist, name: e.target.value })}
          aria-label="Playlist name"
          enterKeyHint="done"
          className="w-full rounded-[10px] bg-transparent px-1 text-[28px] font-bold outline-none transition focus:bg-fill focus:px-3"
        />
        <p className="mt-1 px-1 text-[15px] text-label-2">
          {entries.length} items · switches every {formatInterval(playlist.intervalSec)}
        </p>
        <button
          onClick={() => (running ? stopPlaylist() : startPlaylist(playlist.id))}
          disabled={!connected || entries.length === 0}
          className="btn-primary mt-5 w-full"
        >
          {running ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          {running ? "Stop Playlist" : "Play Playlist"}
        </button>
        {!connected && <p className="mt-2 text-center text-[13px] text-warn">Connect a badge in Garage to play.</p>}
      </div>

      <Section
        title="Items"
        action={
          <button onClick={() => setAdding(true)} className="link-btn min-h-0 text-[15px]">
            Add Items
          </button>
        }
      >
        {entries.length === 0 ? (
          <Row title="Add items from your Library" onClick={() => setAdding(true)} chevron />
        ) : (
          entries.map(({ id, item }, i) => {
            const isCurrent = running && playlistRun && (playlistRun.index - 1 + entries.length) % entries.length === i;
            return (
              <Row
                key={id}
                icon={<Thumb src={item!.thumb} size={40} ring={!!isCurrent} />}
                title={item!.name}
                subtitle={isCurrent ? "On the badge" : `#${i + 1}`}
                accessory={
                  <span className="flex items-center gap-1">
                    <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="btn-icon h-9 w-9 bg-transparent">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, i + 1)}
                      disabled={i === entries.length - 1}
                      aria-label="Move down"
                      className="btn-icon h-9 w-9 bg-transparent"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => updatePlaylist({ ...playlist, itemIds: playlist.itemIds.filter((x) => x !== id) })}
                      aria-label={`Remove ${item!.name}`}
                      className="btn-icon h-9 w-9 bg-transparent text-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                }
              />
            );
          })
        )}
      </Section>

      <Section title="Playback" footer="Playlists run from your phone, so keep the app open and the badge linked while one plays.">
        <div className="px-4 py-3">
          <p className="mb-2 text-[15px]">Switch every</p>
          <Segmented
            value={String(playlist.intervalSec) as (typeof INTERVALS)[number]["id"]}
            options={INTERVALS.map((x) => ({ id: x.id, label: x.label }))}
            onChange={(v) => updatePlaylist({ ...playlist, intervalSec: Number(v) })}
          />
        </div>
        <Row title="Loop" accessory={<Toggle checked={playlist.loop} onChange={(loop) => updatePlaylist({ ...playlist, loop })} label="Loop" />} />
      </Section>

      <Section>
        <Row
          title="Delete Playlist"
          destructive
          onClick={() => {
            deletePlaylist(playlist.id);
            onBack();
          }}
        />
      </Section>

      <AddItemsSheet playlist={playlist} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

export function PlaylistsScreen() {
  const { connectionState } = useBadge();
  const { playlists, createPlaylist, itemById, playlistRun, startPlaylist, stopPlaylist } = useAutomation();
  const [openId, setOpenId] = useState<string | null>(null);
  const connected = connectionState === "connected";
  const open = playlists.find((p) => p.id === openId);

  const go = (id: string | null) => {
    setOpenId(id);
    window.scrollTo({ top: 0 });
  };

  if (open) return <PlaylistDetail playlist={open} onBack={() => go(null)} />;

  return (
    <div>
      <ScreenHeader
        title="Playlists"
        actions={
          <button onClick={() => go(createPlaylist(`Playlist ${playlists.length + 1}`).id)} className="btn-icon" aria-label="New playlist">
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        }
      />

      {playlists.length === 0 ? (
        <div className="list-group">
          <EmptyState
            icon={<ListVideo className="h-6 w-6" />}
            title="No playlists yet"
            body="Line up faces and animations and the badge cycles through them on a timer."
            action={
              <button onClick={() => go(createPlaylist("Playlist 1").id)} className="btn-primary">
                <Plus className="h-5 w-5" />
                New Playlist
              </button>
            }
          />
        </div>
      ) : (
        <Section footer="Tap a playlist to edit its order and timing.">
          {playlists.map((p) => {
            const first = p.itemIds.map(itemById).find(Boolean);
            const running = playlistRun?.playlistId === p.id;
            return (
              <Row
                key={p.id}
                icon={
                  first ? (
                    <Thumb src={first.thumb} size={44} ring={running} />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3">
                      <ListVideo className="h-5 w-5 text-label-2" />
                    </span>
                  )
                }
                title={p.name}
                subtitle={running ? "Playing now" : `${p.itemIds.length} items · every ${formatInterval(p.intervalSec)}`}
                accessory={
                  <PlayButton
                    running={running}
                    disabled={!connected || p.itemIds.length === 0}
                    onToggle={() => (running ? stopPlaylist() : startPlaylist(p.id))}
                  />
                }
                chevron
                onClick={() => go(p.id)}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}
