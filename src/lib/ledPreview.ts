import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";
import { loadImage } from "./imageEncode";

export interface LedPreviewOptions {
  /** LEDs per side of the square matrix (e.g. 64 = 64×64). */
  matrix?: number;
  /** Gap between LEDs as a fraction of the cell pitch. */
  gap?: number;
  /** Radius multiplier of each LED's glow relative to the cell pitch. */
  glow?: number;
  /** Sample luminance below this is treated as an unlit LED. */
  threshold?: number;
}

const DEFAULT_OPTIONS: Required<LedPreviewOptions> = {
  matrix: 64,
  gap: 0.22,
  glow: 1.05,
  threshold: 12,
};

/** Quantizes a pixel to RGB565 (the badge's bit depth) and expands it back to 8-bit. */
export function quantizeToRgb565(r: number, g: number, b: number): [number, number, number] {
  const r5 = r & 0xf8;
  const g6 = g & 0xfc;
  const b5 = b & 0xf8;
  return [r5 | (r5 >> 5), g6 | (g6 >> 6), b5 | (b5 >> 5)];
}

/**
 * Renders a face data URL the way the badge's LED matrix will show it:
 * sampled onto an LED grid, quantized to RGB565, with per-LED glow on a dark
 * backing. Returns a PNG data URL at the badge's native resolution.
 */
export async function renderLedPreview(sourceUrl: string, options: LedPreviewOptions = {}): Promise<string> {
  const { matrix, gap, glow, threshold } = { ...DEFAULT_OPTIONS, ...options };
  const img = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  ctx.drawImage(img, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  const { data } = ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  const cell = DISPLAY_WIDTH / matrix;
  const coreR = (cell * (1 - gap)) / 2;
  const glowR = cell * glow;

  for (let my = 0; my < matrix; my++) {
    for (let mx = 0; mx < matrix; mx++) {
      const cx = mx * cell + cell / 2;
      const cy = my * cell + cell / 2;
      const px = Math.floor(cx);
      const py = Math.floor(cy);
      const idx = (py * DISPLAY_WIDTH + px) * 4;
      const alpha = data[idx + 3];
      const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

      let r: number;
      let g: number;
      let b: number;
      if (alpha < 64 || lum < threshold) {
        r = 17;
        g = 17;
        b = 20;
      } else {
        [r, g, b] = quantizeToRgb565(data[idx], data[idx + 1], data[idx + 2]);
      }

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas.toDataURL("image/png");
}

const CACHE_LIMIT = 60;
const cache = new Map<string, string>();

export function cachedLedPreview(sourceUrl: string, matrix: number): string | null {
  return cache.get(`${matrix}|${sourceUrl}`) ?? null;
}

export function requestLedPreview(sourceUrl: string, matrix: number): Promise<string> {
  const key = `${matrix}|${sourceUrl}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return renderLedPreview(sourceUrl, { matrix }).then((url) => {
    cache.set(key, url);
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return url;
  });
}
