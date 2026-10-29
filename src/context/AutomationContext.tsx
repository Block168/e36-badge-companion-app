import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBadge } from "./BadgeContext";
import { PRESET_FACES } from "../data/presetFaces";
import { renderPresetFaceDataUrl } from "../lib/presetRender";
import { speedGaugeDataUrl } from "../components/LiveGauge";
import { useGeoSpeed } from "../lib/liveSpeed";
import {
  deleteAnimationFrames,
  getAnimationFrames,
  inTimeWindow,
  loadAnimationIndex,
  loadBootItemId,
  loadNightMode,
  loadNowPlaying,
  loadPlaylists,
  loadTriggers,
  makeThumb,
  putAnimationFrames,
  saveAnimationIndex,
  saveBootItemId,
  saveNightMode,
  saveNowPlaying,
  savePlaylists,
  saveTriggers,
  type NightModeSettings,
  type NowPlaying,
  type Playlist,
  type SavedAnimationMeta,
  type Trigger,
} from "../lib/library";
import type { AnimationFrame, PresetFace } from "../types";

export type LibraryItem =
  | { kind: "preset"; id: string; name: string; thumb: string; dataUrl: string; preset: PresetFace }
  | { kind: "custom"; id: string; name: string; thumb: string; dataUrl: string }
  | { kind: "animation"; id: string; name: string; thumb: string; meta: SavedAnimationMeta }
  | { kind: "live"; id: string; name: string; thumb: string };

export const LIVE_ITEM_ID = "live";

/** Speed must hold above (or drop 5 km/h below) a threshold this long before a trigger flips. */
const SPEED_HOLD_MS = 3000;
const SPEED_RELEASE_MARGIN = 5;
const DAY_BRIGHTNESS_KEY = "e36.dayBrightness";

interface PlaylistRun {
  playlistId: string;
  index: number;
}

interface AutomationValue {
  items: LibraryItem[];
  itemById: (id: string) => LibraryItem | undefined;
  animations: SavedAnimationMeta[];
  saveAnimation: (name: string, frames: AnimationFrame[]) => Promise<SavedAnimationMeta>;
  deleteAnimation: (id: string) => Promise<void>;
  loadFrames: (animationId: string) => Promise<AnimationFrame[]>;

  nowPlaying: NowPlaying | null;
  playItem: (itemId: string) => Promise<boolean>;

  playlists: Playlist[];
  createPlaylist: (name: string) => Playlist;
  updatePlaylist: (playlist: Playlist) => void;
  deletePlaylist: (id: string) => void;
  playlistRun: PlaylistRun | null;
  startPlaylist: (id: string) => void;
  stopPlaylist: () => void;

  triggers: Trigger[];
  upsertTrigger: (trigger: Trigger) => void;
  deleteTrigger: (id: string) => void;
  activeTriggerId: string | null;

  nightMode: NightModeSettings;
  setNightMode: (settings: NightModeSettings) => void;
  nightActive: boolean;

  bootItemId: string | null;
  setBootItem: (itemId: string) => Promise<boolean>;

  speed: { kmh: number; live: boolean };
}

const AutomationContext = createContext<AutomationValue | null>(null);

export function AutomationProvider({ children }: { children: ReactNode }) {
  const badge = useBadge();
  const { connectionState, customFaces, sendFace, sendAnimation, commitBrightness, setBrightness, brightness } = badge;
  const connected = connectionState === "connected";

  const [animations, setAnimations] = useState<SavedAnimationMeta[]>(() => loadAnimationIndex());
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());
  const [triggers, setTriggers] = useState<Trigger[]>(() => loadTriggers());
  const [nightMode, setNightModeState] = useState<NightModeSettings>(() => loadNightMode());
  const [bootItemId, setBootItemId] = useState<string | null>(() => loadBootItemId());
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(() => loadNowPlaying());
  const [playlistRun, setPlaylistRun] = useState<PlaylistRun | null>(null);
  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null);
  const [nightActive, setNightActive] = useState(false);

  const geo = useGeoSpeed(1000, connected);
  const speedLive = geo.active && !geo.simulated;

  // ---------------------------------------------------------------- library

  const presetItems = useMemo<LibraryItem[]>(
    () =>
      PRESET_FACES.map((preset) => {
        const dataUrl = renderPresetFaceDataUrl(preset);
        return { kind: "preset", id: `preset:${preset.id}`, name: preset.name, thumb: dataUrl, dataUrl, preset };
      }),
    [],
  );
  const liveItem = useMemo<LibraryItem>(
    () => ({ kind: "live", id: LIVE_ITEM_ID, name: "Live Speed Gauge", thumb: speedGaugeDataUrl(88, false) }),
    [],
  );

  const items = useMemo<LibraryItem[]>(
    () => [
      liveItem,
      ...animations.map<LibraryItem>((meta) => ({
        kind: "animation",
        id: `anim:${meta.id}`,
        name: meta.name,
        thumb: meta.thumb,
        meta,
      })),
      ...customFaces.map<LibraryItem>((f) => ({
        kind: "custom",
        id: `custom:${f.id}`,
        name: f.name,
        thumb: f.dataUrl,
        dataUrl: f.dataUrl,
      })),
      ...presetItems,
    ],
    [liveItem, animations, customFaces, presetItems],
  );

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemById = useCallback((id: string) => itemMap.get(id), [itemMap]);

  const saveAnimation = useCallback(async (name: string, frames: AnimationFrame[]) => {
    const id = crypto.randomUUID();
    await putAnimationFrames(id, frames);
    const cover = frames.find((f) => !f.dim) ?? frames[0];
    const meta: SavedAnimationMeta = {
      id,
      name: name.trim() || "Untitled Animation",
      frameCount: frames.length,
      totalMs: frames.reduce((t, f) => t + f.durationMs, 0),
      thumb: await makeThumb(cover.dataUrl),
      createdAt: Date.now(),
    };
    setAnimations((prev) => {
      const next = [meta, ...prev];
      saveAnimationIndex(next);
      return next;
    });
    return meta;
  }, []);

  const deleteAnimation = useCallback(async (id: string) => {
    await deleteAnimationFrames(id);
    setAnimations((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAnimationIndex(next);
      return next;
    });
  }, []);

  // ------------------------------------------------------------- playback

  const busyRef = useRef(false);
  const kmhRef = useRef(geo.kmh);
  kmhRef.current = geo.kmh;
  const simulatedRef = useRef(geo.simulated);
  simulatedRef.current = geo.simulated;

  const send = useCallback(
    async (item: LibraryItem, source: NowPlaying["source"]): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      // Only hand-picked items become the badge's startup content.
      const opts = { quiet: source === "playlist" || source === "trigger", persist: source === "manual" || source === "boot" };
      try {
        let ok = false;
        if (item.kind === "animation") {
          const frames = await getAnimationFrames(item.meta.id);
          ok = await sendAnimation(frames, item.name, opts);
        } else if (item.kind === "live") {
          const kmh = Math.round(kmhRef.current);
          ok = await sendFace(speedGaugeDataUrl(kmh, simulatedRef.current), `Live Speed · ${kmh} km/h`, opts);
        } else {
          ok = await sendFace(item.dataUrl, item.name, opts);
        }
        if (ok) {
          const np: NowPlaying = { itemId: item.id, name: item.name, source, startedAt: Date.now() };
          setNowPlaying(np);
          saveNowPlaying(np);
          if (opts.persist) {
            setBootItemId(item.id);
            saveBootItemId(item.id);
          }
        }
        return ok;
      } finally {
        busyRef.current = false;
      }
    },
    [sendAnimation, sendFace],
  );

  const playlistRunRef = useRef<PlaylistRun | null>(null);
  playlistRunRef.current = playlistRun;
  const nextDueRef = useRef(0);

  const playItem = useCallback(
    async (itemId: string) => {
      const item = itemMap.get(itemId);
      if (!item) return false;
      setPlaylistRun(null);
      return send(item, "manual");
    },
    [itemMap, send],
  );

  const setBootItem = useCallback(
    async (itemId: string) => {
      const item = itemMap.get(itemId);
      if (!item) return false;
      return send(item, "boot");
    },
    [itemMap, send],
  );

  // ------------------------------------------------------------- playlists

  const createPlaylist = useCallback((name: string) => {
    const playlist: Playlist = { id: crypto.randomUUID(), name, itemIds: [], intervalSec: 30, loop: true };
    setPlaylists((prev) => {
      const next = [...prev, playlist];
      savePlaylists(next);
      return next;
    });
    return playlist;
  }, []);

  const updatePlaylist = useCallback((playlist: Playlist) => {
    setPlaylists((prev) => {
      const next = prev.map((p) => (p.id === playlist.id ? playlist : p));
      savePlaylists(next);
      return next;
    });
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePlaylists(next);
      return next;
    });
    setPlaylistRun((run) => (run?.playlistId === id ? null : run));
  }, []);

  const startPlaylist = useCallback((id: string) => {
    nextDueRef.current = 0;
    setPlaylistRun({ playlistId: id, index: 0 });
  }, []);
  const stopPlaylist = useCallback(() => setPlaylistRun(null), []);

  // -------------------------------------------------------------- triggers

  const upsertTrigger = useCallback((trigger: Trigger) => {
    setTriggers((prev) => {
      const exists = prev.some((t) => t.id === trigger.id);
      const next = exists ? prev.map((t) => (t.id === trigger.id ? trigger : t)) : [...prev, trigger];
      saveTriggers(next);
      return next;
    });
  }, []);

  const deleteTrigger = useCallback((id: string) => {
    setTriggers((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTriggers(next);
      return next;
    });
  }, []);

  const setNightMode = useCallback((settings: NightModeSettings) => {
    setNightModeState(settings);
    saveNightMode(settings);
  }, []);

  // ---------------------------------------------------------------- engine
  // One 1s tick decides, in priority order: Night Mode brightness, then
  // triggers, then the running playlist. Everything runs from the phone, so
  // it only works while the app is open and linked.

  const speedState = useRef(new Map<string, { on: boolean; since: number }>());
  const activeTriggerRef = useRef<string | null>(null);
  const nightRef = useRef<boolean | null>(null);
  const latest = useRef({ triggers, playlists, nightMode, brightness, itemMap, speedLive, activeTransfer: badge.activeTransfer });
  latest.current = { triggers, playlists, nightMode, brightness, itemMap, speedLive, activeTransfer: badge.activeTransfer };

  useEffect(() => {
    if (!connected) {
      nightRef.current = null;
      activeTriggerRef.current = null;
      setActiveTriggerId(null);
      setNightActive(false);
      speedState.current.clear();
      return;
    }

    const speedHolds = (t: Trigger, now: number): boolean => {
      if (t.condition.kind !== "speed") return false;
      const st = speedState.current.get(t.id) ?? { on: false, since: now };
      const kmh = kmhRef.current;
      const want = st.on ? kmh >= t.condition.aboveKmh - SPEED_RELEASE_MARGIN : kmh >= t.condition.aboveKmh;
      if (want === st.on) st.since = now;
      else if (now - st.since >= SPEED_HOLD_MS) {
        st.on = want;
        st.since = now;
      }
      speedState.current.set(t.id, st);
      return st.on;
    };

    const tick = async () => {
      const L = latest.current;
      if (busyRef.current || L.activeTransfer) return;
      const now = Date.now();

      // Night Mode
      const night = L.nightMode.enabled && inTimeWindow(L.nightMode.start, L.nightMode.end);
      if (nightRef.current === null && !night) nightRef.current = false;
      if (night !== nightRef.current) {
        busyRef.current = true;
        try {
          let target: number;
          if (night) {
            localStorage.setItem(DAY_BRIGHTNESS_KEY, String(L.brightness));
            target = L.nightMode.level;
          } else {
            target = Number(localStorage.getItem(DAY_BRIGHTNESS_KEY) ?? L.brightness);
          }
          if (await commitBrightness(target)) {
            setBrightness(target);
            nightRef.current = night;
            setNightActive(night);
          }
        } finally {
          busyRef.current = false;
        }
        return;
      }

      // Triggers — speed before time (the order the Triggers screen shows), first match wins.
      const ordered = [...L.triggers].sort((a, b) => Number(a.condition.kind === "time") - Number(b.condition.kind === "time"));
      const matched = ordered.find((t) => {
        if (!t.enabled || !L.itemMap.has(t.itemId)) return false;
        if (t.condition.kind === "time") return inTimeWindow(t.condition.start, t.condition.end);
        return L.speedLive && speedHolds(t, now);
      });
      if (matched) {
        if (activeTriggerRef.current !== matched.id) {
          if (await send(L.itemMap.get(matched.itemId)!, "trigger")) {
            activeTriggerRef.current = matched.id;
            setActiveTriggerId(matched.id);
          }
        }
        return;
      }
      if (activeTriggerRef.current) {
        activeTriggerRef.current = null;
        setActiveTriggerId(null);
        nextDueRef.current = 0; // let a paused playlist resume right away
      }

      // Playlist
      const run = playlistRunRef.current;
      if (!run || now < nextDueRef.current) return;
      const playlist = L.playlists.find((p) => p.id === run.playlistId);
      const ids = playlist?.itemIds.filter((id) => L.itemMap.has(id)) ?? [];
      if (!playlist || ids.length === 0) {
        setPlaylistRun(null);
        return;
      }
      if (run.index >= ids.length && !playlist.loop) {
        setPlaylistRun(null);
        return;
      }
      const index = run.index % ids.length;
      const ok = await send(L.itemMap.get(ids[index])!, "playlist");
      // A failed send retries after a short back-off instead of skipping.
      nextDueRef.current = Date.now() + (ok ? playlist.intervalSec * 1000 : 5000);
      if (ok && playlistRunRef.current?.playlistId === run.playlistId) {
        setPlaylistRun({ playlistId: run.playlistId, index: index + 1 });
      }
    };

    const id = window.setInterval(() => void tick(), 1000);
    return () => window.clearInterval(id);
  }, [connected, commitBrightness, send, setBrightness]);

  const value = useMemo<AutomationValue>(
    () => ({
      items,
      itemById,
      animations,
      saveAnimation,
      deleteAnimation,
      loadFrames: getAnimationFrames,
      nowPlaying,
      playItem,
      playlists,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      playlistRun,
      startPlaylist,
      stopPlaylist,
      triggers,
      upsertTrigger,
      deleteTrigger,
      activeTriggerId,
      nightMode,
      setNightMode,
      nightActive,
      bootItemId,
      setBootItem,
      speed: { kmh: geo.kmh, live: speedLive },
    }),
    [
      items,
      itemById,
      animations,
      saveAnimation,
      deleteAnimation,
      nowPlaying,
      playItem,
      playlists,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      playlistRun,
      startPlaylist,
      stopPlaylist,
      triggers,
      upsertTrigger,
      deleteTrigger,
      activeTriggerId,
      nightMode,
      setNightMode,
      nightActive,
      bootItemId,
      setBootItem,
      geo.kmh,
      speedLive,
    ],
  );

  return <AutomationContext.Provider value={value}>{children}</AutomationContext.Provider>;
}

export function useAutomation(): AutomationValue {
  const ctx = useContext(AutomationContext);
  if (!ctx) throw new Error("useAutomation must be used within an AutomationProvider");
  return ctx;
}
