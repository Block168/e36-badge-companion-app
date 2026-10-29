import type { AnimationFrame } from "../types";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol";
import { loadImage } from "./imageEncode";

const SIZE_SCALE = Math.SQRT2;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Draws one frame of the Sharingan eye motif on the badge canvas.
 * The context must already be translated so the eye is centred at the origin
 * and the background cleared to black.
 *
 * Timeline over one ~3s loop (t in [0,1]):
 *   0.00–0.30  three tomoe settle around the pupil
 *   0.30–0.68  tomoe morph into a three-blade Mangekyō pinwheel (wind-up spin)
 *   0.68–1.00  pinwheel holds, slowly rotating, with an awakening flare
 */
function drawSharingan(ctx: CanvasRenderingContext2D, t: number): boolean {
  const irisR = 205;
  const pupilR = 34;
  const ringR = 116;
  const tomoeOrbit = 100;
  const tomoeHeadR = 34;
  const tomoeTailLen = 48;
  const bladeInner = 58;
  const bladeOuter = 168;
  const bladeMid1 = 132;
  const bladeMid2 = 100;

  const morph = smoothstep(0.3, 0.68, t);
  const spin = t * 0.55 * Math.PI * 2 + morph * 1.1 * Math.PI * 2;

  // Iris — warm bright core bleeding to a dark red rim.
  const g = ctx.createRadialGradient(0, 0, pupilR * 1.1, 0, 0, irisR);
  g.addColorStop(0, "#ff4d2e");
  g.addColorStop(0.45, "#d81e05");
  g.addColorStop(0.78, "#9a0d00");
  g.addColorStop(1, "#570400");
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, irisR, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,0,0,0.9)";
  ctx.stroke();

  // Thin guideline ring at mid-radius.
  ctx.beginPath();
  ctx.arc(0, 0, ringR, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(150,12,12,0.55)";
  ctx.stroke();

  // Three tomoe — comma-shaped marks that cross-fade out during the morph.
  if (morph < 1) {
    ctx.fillStyle = "#000";
    ctx.globalAlpha = 1 - morph;
    const headR = tomoeHeadR * (1 - 0.35 * morph);
    const tailLen = tomoeTailLen * (1 - 0.25 * morph);
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * tomoeOrbit, Math.sin(a) * tomoeOrbit, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, tomoeOrbit + tailLen, a + 0.32, a + 1.18);
      ctx.arc(0, 0, tomoeOrbit - 9, a + 1.18, a + 0.32, true);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Three Mangekyō blades — curved, tapering shapes that grow in.
  if (morph > 0) {
    ctx.fillStyle = "#000";
    ctx.globalAlpha = morph;
    const sweep = 0.22 + 0.42 * morph;
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * bladeInner, Math.sin(a) * bladeInner);
      ctx.quadraticCurveTo(
        Math.cos(a + sweep * 0.35) * bladeMid1,
        Math.sin(a + sweep * 0.35) * bladeMid1,
        Math.cos(a + sweep) * bladeOuter,
        Math.sin(a + sweep) * bladeOuter,
      );
      ctx.quadraticCurveTo(
        Math.cos(a + sweep * 0.65) * bladeMid2,
        Math.sin(a + sweep * 0.65) * bladeMid2,
        Math.cos(a) * bladeInner,
        Math.sin(a) * bladeInner,
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  // Awakening flare — a brief white-hot pulse as the pinwheel locks in.
  const flare = Math.sin(smoothstep(0.62, 1, morph) * Math.PI) * 0.55 * morph;
  if (flare > 0.02) {
    ctx.globalAlpha = flare;
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, irisR * 0.9);
    fg.addColorStop(0, "rgba(255,230,210,0.9)");
    fg.addColorStop(0.5, "rgba(255,120,60,0.35)");
    fg.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, irisR * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pupil — drawn last so it always sits on top.
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(0, 0, pupilR, 0, Math.PI * 2);
  ctx.fill();

  return false;
}

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
  | "sharingan";

export interface EffectMeta {
  id: EffectName;
  label: string;
  description: string;
  /** Overrides the default 8 frames for this effect (Sharingan is a ~3s loop). */
  frameCount?: number;
  /** Overrides the default 120ms per-frame duration. */
  frameDurationMs?: number;
}

export const EFFECTS: EffectMeta[] = [
  { id: "sharingan", label: "Sharingan", description: "Tomoe → Mangekyō pinwheel morph (~3s)", frameCount: 20, frameDurationMs: 150 },
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
      case "sharingan": {
        dim = drawSharingan(ctx, t);
        break;
      }
    }

    ctx.restore();
    frames.push({ id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/png"), durationMs, dim });
  }

  return frames;
}
