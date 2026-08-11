import type { AnimationFrame } from "../types";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";
import { loadImage } from "./imageEncode";

const SIZE_SCALE = Math.SQRT2;

export type EffectName =
  | "blink"
  | "pulse"
  | "wipe-down"
  | "spin"
  | "fade"
  | "heartbeat"
  | "strobe"
  | "rainbow"
  | "scroll"
  | "marquee";

export interface EffectMeta {
  id: EffectName;
  label: string;
  description: string;
}

export const EFFECTS: EffectMeta[] = [
  { id: "blink", label: "Blink", description: "Hard on/off flash" },
  { id: "pulse", label: "Pulse", description: "Smooth breathe in/out" },
  { id: "fade", label: "Fade", description: "Fade in then out to black" },
  { id: "heartbeat", label: "Heartbeat", description: "Double-pulse like a heartbeat" },
  { id: "strobe", label: "Strobe", description: "Rapid on/off strobe flash" },
  { id: "rainbow", label: "Rainbow", description: "Cycle the face through hues" },
  { id: "wipe-down", label: "Wipe Down", description: "Reveal from the top" },
  { id: "scroll", label: "Scroll", description: "Seamless horizontal scroll" },
  { id: "spin", label: "Spin", description: "Full clockwise rotation" },
  { id: "marquee", label: "Marquee Text", description: "Scroll custom text across the badge" },
];

export interface EffectOptions {
  /** Text rendered by the "marquee" effect. */
  text?: string;
}

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
  options?: EffectOptions,
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
    let dim = false;

    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    ctx.translate(halfW, halfH);

    switch (effect) {
      case "blink": {
        const on = i % 2 === 0;
        dim = !on;
        ctx.globalAlpha = on ? 1 : 0.12;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "pulse": {
        const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        dim = alpha < 0.55;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "fade": {
        const alpha = 1 - Math.abs(1 - 2 * t);
        dim = alpha < 0.55;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "heartbeat": {
        const beat = Math.pow(Math.abs(Math.sin(t * Math.PI * 2)), 3);
        const alpha = 0.5 + 0.5 * beat;
        dim = alpha < 0.55;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "strobe": {
        const on = i % 3 === 0;
        dim = !on;
        ctx.globalAlpha = on ? 1 : 0.05;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "rainbow": {
        const hue = Math.round(t * 360) % 360;
        ctx.drawImage(img, -halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        ctx.globalCompositeOperation = "hue";
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(-halfW, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
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
      case "scroll": {
        const offset = DISPLAY_WIDTH * t;
        ctx.drawImage(img, -halfW - offset, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        ctx.drawImage(img, -halfW - offset + DISPLAY_WIDTH, -halfH, DISPLAY_WIDTH, DISPLAY_HEIGHT);
        break;
      }
      case "spin": {
        ctx.rotate(t * Math.PI * 2);
        const scaled = SIZE_SCALE * 480;
        ctx.drawImage(img, -scaled / 2, -scaled / 2, scaled, scaled);
        break;
      }
      case "marquee": {
        const text = (options?.text?.trim() || "E36").toUpperCase();
        ctx.font = "800 96px Orbitron, 'Chakra Petch', sans-serif";
        ctx.textBaseline = "middle";
        const gap = 160;
        const textWidth = ctx.measureText(text).width;
        const step = textWidth + gap;
        const travel = textWidth + DISPLAY_WIDTH + gap;
        const x = DISPLAY_WIDTH - travel * t + gap / 2;
        for (let copy = 0; copy < 2; copy++) {
          const cx = x + copy * step;
          ctx.fillStyle = "#fff";
          ctx.shadowColor = "#3b82f6";
          ctx.shadowBlur = 28;
          ctx.fillText(text, cx, 0);
          ctx.shadowBlur = 0;
        }
        break;
      }
    }

    ctx.restore();
    frames.push({ id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/png"), durationMs, dim });
  }

  return frames;
}
