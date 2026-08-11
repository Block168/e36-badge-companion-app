import type { AnimationFrame } from "../types";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";
import { loadImage } from "./imageEncode";

const SIZE_SCALE = Math.SQRT2;

export type EffectName = "blink" | "pulse" | "wipe-down" | "spin";

export interface EffectMeta {
  id: EffectName;
  label: string;
  description: string;
}

export const EFFECTS: EffectMeta[] = [
  { id: "blink", label: "Blink", description: "Hard on/off flash" },
  { id: "pulse", label: "Pulse", description: "Smooth breathe in/out" },
  { id: "wipe-down", label: "Wipe Down", description: "Reveal from the top" },
  { id: "spin", label: "Spin", description: "Full clockwise rotation" },
];

/**
 * Generates a sequence of animation frames by applying a looping effect to a
 * base face image. The base image is loaded once and every frame is drawn to
 * a 480x480 canvas with per-frame transforms.
 */
export async function generateEffectFrames(
  baseDataUrl: string,
  effect: EffectName,
  frameCount = 8,
  durationMs = 120,
): Promise<AnimationFrame[]> {
  const img = await loadImage(baseDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const halfW = DISPLAY_WIDTH / 2;
  const halfH = DISPLAY_HEIGHT / 2;

  const frames: AnimationFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = frameCount > 1 ? i / (frameCount - 1) : 0;

    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    ctx.translate(halfW, halfH);

    switch (effect) {
      case "blink": {
        ctx.globalAlpha = i % 2 === 0 ? 1 : 0.12;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "pulse": {
        const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "wipe-down": {
        const h = Math.max(1, DISPLAY_HEIGHT * t);
        ctx.beginPath();
        ctx.rect(-halfW, -halfH, DISPLAY_WIDTH, h);
        ctx.clip();
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "spin": {
        ctx.rotate(t * Math.PI * 2);
        const scaled = SIZE_SCALE * 480;
        ctx.drawImage(img, -scaled / 2, -scaled / 2, scaled, scaled);
        break;
      }
    }

    ctx.restore();
    frames.push({ id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/png"), durationMs });
  }

  return frames;
}
