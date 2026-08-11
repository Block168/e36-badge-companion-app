import type { CustomFace, TransferRecord } from "../types";

const HISTORY_KEY = "e36.transferHistory";
const CUSTOM_FACES_KEY = "e36.customFaces";
const BRIGHTNESS_KEY = "e36.lastBrightness";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadHistory(): TransferRecord[] {
  return safeParse<TransferRecord[]>(localStorage.getItem(HISTORY_KEY), []);
}

export function saveHistory(records: TransferRecord[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 200)));
}

export function loadCustomFaces(): CustomFace[] {
  return safeParse<CustomFace[]>(localStorage.getItem(CUSTOM_FACES_KEY), []);
}

export function saveCustomFaces(faces: CustomFace[]): void {
  try {
    localStorage.setItem(CUSTOM_FACES_KEY, JSON.stringify(faces.slice(0, 40)));
  } catch {
    // Storage quota exceeded (data URLs can be large) — drop oldest and retry once.
    if (faces.length > 1) {
      saveCustomFaces(faces.slice(0, Math.max(1, faces.length - 5)));
    }
  }
}

export function loadLastBrightness(): number {
  const raw = localStorage.getItem(BRIGHTNESS_KEY);
  return raw ? Number(raw) : 70;
}

export function saveLastBrightness(value: number): void {
  localStorage.setItem(BRIGHTNESS_KEY, String(value));
}
