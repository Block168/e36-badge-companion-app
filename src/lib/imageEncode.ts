import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";

/**
 * Loads an image from a data URL / object URL into an HTMLImageElement.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draws an arbitrary source image onto a square canvas, cropping to center
 * and scaling to the badge's native 480x480 resolution.
 */
export async function normalizeToDisplaySquare(src: string): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const size = Math.min(img.width, img.height);
  const sx = (img.width - size) / 2;
  const sy = (img.height - size) / 2;

  ctx.drawImage(img, sx, sy, size, size, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  return canvas.toDataURL("image/png");
}

/**
 * Encodes a 480x480 image data URL into a raw RGB565 byte buffer, matching
 * the pixel format expected by the badge's display controller.
 */
export async function encodeToRgb565(dataUrl: string): Promise<Uint8Array> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  const { data } = ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  const out = new Uint8Array(DISPLAY_WIDTH * DISPLAY_HEIGHT * 2);

  let outIdx = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    out[outIdx++] = (rgb565 >> 8) & 0xff;
    out[outIdx++] = rgb565 & 0xff;
  }

  return out;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
