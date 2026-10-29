import type { AnimationFrame } from "../types";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";
import { loadImage } from "./imageEncode";
import { drawMangekyo, drawPlasmaCore, drawRadar, drawRevMeter, drawRinnegan, drawSharingan, drawTurbo } from "./signatureEffects";

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
  | "marquee"
  | "sharingan"
  | "mangekyo"
  | "rinnegan"
  | "turbo"
  | "radar"
  | "rev-meter"
  | "plasma-core";

export interface EffectMeta {
  id: EffectName;
  label: string;
  description: string;
  /** "signature" effects are drawn from scratch; "face" effects transform the last frame. */
  group: "signature" | "face";
  /** Overrides the default 8 frames for this effect. */
  frameCount?: number;
  /** Overrides the default 120ms per-frame duration. */
  frameDurationMs?: number;
  /**
   * False for one-shot effects that should end on their final state. Looping
   * effects sample t in [0,1) so the last frame flows into the first instead
   * of repeating it, which is what makes the loop seamless.
   */
  loop?: boolean;
}

/** Signature effects, keyed to their drawing function. */
const SIGNATURE_DRAW: Partial<Record<EffectName, (ctx: CanvasRenderingContext2D, t: number) => void>> = {
  sharingan: drawSharingan,
  mangekyo: drawMangekyo,
  rinnegan: drawRinnegan,
  turbo: drawTurbo,
  radar: drawRadar,
  "rev-meter": drawRevMeter,
  "plasma-core": drawPlasmaCore,
};

export const EFFECTS: EffectMeta[] = [
  { id: "sharingan", group: "signature", label: "Sharingan", description: "Tomoe awaken into the Mangekyō and settle back", frameCount: 20, frameDurationMs: 110 },
  { id: "mangekyo", group: "signature", label: "Mangekyō", description: "Endlessly spinning pinwheel with a motion trail", frameCount: 16, frameDurationMs: 70 },
  { id: "rinnegan", group: "signature", label: "Rinnegan", description: "Ripple rings flowing outward", frameCount: 16, frameDurationMs: 80 },
  { id: "turbo", group: "signature", label: "Turbo", description: "Compressor wheel spinning at full boost", frameCount: 12, frameDurationMs: 45 },
  { id: "radar", group: "signature", label: "Radar", description: "Sweeping beam that lights up targets", frameCount: 20, frameDurationMs: 75 },
  { id: "rev-meter", group: "signature", label: "Rev Meter", description: "Revs to a flashing redline, then back to idle", frameCount: 20, frameDurationMs: 80 },
  { id: "plasma-core", group: "signature", label: "Plasma Core", description: "Counter-rotating rings around a glowing core", frameCount: 16, frameDurationMs: 75 },
  { id: "blink", group: "face", label: "Blink", description: "Hard on/off flash" },
  { id: "pulse", group: "face", label: "Pulse", description: "Smooth breathe in/out", frameCount: 12, frameDurationMs: 90 },
  { id: "fade", group: "face", label: "Fade", description: "Fade in then out to black", frameCount: 12, frameDurationMs: 90 },
  { id: "heartbeat", group: "face", label: "Heartbeat", description: "Double-pulse like a heartbeat", frameCount: 12, frameDurationMs: 90 },
  { id: "strobe", group: "face", label: "Strobe", description: "Rapid on/off strobe flash" },
  { id: "rainbow", group: "face", label: "Rainbow", description: "Cycle the face through hues", frameCount: 12, frameDurationMs: 90 },
  { id: "wipe-down", group: "face", label: "Wipe Down", description: "Reveal from the top", loop: false },
  { id: "scroll", group: "face", label: "Scroll", description: "Seamless horizontal scroll", frameCount: 12, frameDurationMs: 80 },
  { id: "spin", group: "face", label: "Spin", description: "Full clockwise rotation", frameCount: 12, frameDurationMs: 80 },
  { id: "marquee", group: "face", label: "Marquee Text", description: "Scroll custom text across the badge", loop: false },
];

/** Small still of a signature effect for its Studio tile (null for face effects). */
export function renderSignatureThumb(effect: EffectName, size = 96, t = 0.3): string | null {
  const draw = SIGNATURE_DRAW[effect];
  if (!draw) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / DISPLAY_WIDTH, size / DISPLAY_HEIGHT);
  draw(ctx, t);
  return canvas.toDataURL("image/png");
}

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

  const loop = EFFECTS.find((e) => e.id === effect)?.loop !== false;
  const signature = SIGNATURE_DRAW[effect];

  const frames: AnimationFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = loop ? i / frameCount : frameCount > 1 ? i / (frameCount - 1) : 0;
    let dim = false;

    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    ctx.translate(halfW, halfH);

    if (signature) {
      signature(ctx, t);
    } else switch (effect) {
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
