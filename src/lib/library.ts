import type { AnimationFrame } from "../types";

/** Lightweight index entry for an animation saved in the Library. Frames live in IndexedDB. */
export interface SavedAnimationMeta {
  id: string;
  name: string;
  frameCount: number;
  totalMs: number;
  /** Small JPEG of the first bright frame, for list rows and grids. */
  thumb: string;
  createdAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  /** Library item ids, in play order. */
  itemIds: string[];
  /** How long each item stays on the badge before the next one is sent. */
  intervalSec: number;
  loop: boolean;
}

export type TriggerCondition =
  | { kind: "speed"; aboveKmh: number }
  | { kind: "time"; start: string; end: string };

export interface Trigger {
  id: string;
  name: string;
  enabled: boolean;
  condition: TriggerCondition;
  itemId: string;
}

export interface NightModeSettings {
  enabled: boolean;
  level: number;
  start: string;
  end: string;
}

export interface NowPlaying {
  itemId: string;
  name: string;
  source: "manual" | "playlist" | "trigger" | "boot";
  startedAt: number;
}

const ANIM_INDEX_KEY = "e36.savedAnimations";
const PLAYLISTS_KEY = "e36.playlists";
const TRIGGERS_KEY = "e36.triggers";
const NIGHT_KEY = "e36.nightMode";
const BOOT_KEY = "e36.bootItem";
const NOW_PLAYING_KEY = "e36.nowPlaying";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — the in-memory state still works for this session.
  }
}

export const loadAnimationIndex = () => read<SavedAnimationMeta[]>(ANIM_INDEX_KEY, []);
export const saveAnimationIndex = (v: SavedAnimationMeta[]) => write(ANIM_INDEX_KEY, v);
export const loadPlaylists = () => read<Playlist[]>(PLAYLISTS_KEY, []);
export const savePlaylists = (v: Playlist[]) => write(PLAYLISTS_KEY, v);
export const loadTriggers = () => read<Trigger[]>(TRIGGERS_KEY, []);
export const saveTriggers = (v: Trigger[]) => write(TRIGGERS_KEY, v);
export const loadNightMode = () =>
  read<NightModeSettings>(NIGHT_KEY, { enabled: false, level: 20, start: "20:00", end: "06:00" });
export const saveNightMode = (v: NightModeSettings) => write(NIGHT_KEY, v);
/** Library item last saved as the badge's startup content. */
export const loadBootItemId = () => read<string | null>(BOOT_KEY, null);
export const saveBootItemId = (v: string | null) => write(BOOT_KEY, v);
export const loadNowPlaying = () => read<NowPlaying | null>(NOW_PLAYING_KEY, null);
export const saveNowPlaying = (v: NowPlaying | null) => write(NOW_PLAYING_KEY, v);

// ------------------------------------------------------------ IndexedDB frames

const DB_NAME = "e36-library";
const STORE = "animationFrames";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const putAnimationFrames = (id: string, frames: AnimationFrame[]) =>
  tx("readwrite", (s) => s.put(frames, id)).then(() => undefined);
export const getAnimationFrames = (id: string) =>
  tx<AnimationFrame[] | undefined>("readonly", (s) => s.get(id)).then((v) => v ?? []);
export const deleteAnimationFrames = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined);

// ------------------------------------------------------------------- helpers

export function makeThumb(dataUrl: string, size = 128): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** "HH:MM" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** True when `now` falls inside [start, end), wrapping past midnight when end < start. */
export function inTimeWindow(start: string, end: string, now = new Date()): boolean {
  const t = now.getHours() * 60 + now.getMinutes();
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === b) return true;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

export function describeCondition(c: TriggerCondition): string {
  return c.kind === "speed" ? `Above ${c.aboveKmh} km/h` : `${c.start} – ${c.end}`;
}
