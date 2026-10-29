// Signature animations: drawn from scratch (not from a face), each a seamless
// loop. Every function draws one frame centred at the origin on a cleared
// black 480x480 canvas, for t in [0,1) where the frame after the last is t=0.

const TAU = Math.PI * 2;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const at = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

// ------------------------------------------------------------ Sharingan family

function drawSharinganIris(ctx: CanvasRenderingContext2D): void {
  const irisR = 205;
  const g = ctx.createRadialGradient(0, 0, 34 * 1.1, 0, 0, irisR);
  g.addColorStop(0, "#ff4d2e");
  g.addColorStop(0.45, "#d81e05");
  g.addColorStop(0.78, "#9a0d00");
  g.addColorStop(1, "#570400");
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, irisR, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,0,0,0.9)";
  ctx.stroke();

  // Thin guideline ring at mid-radius.
  ctx.beginPath();
  ctx.arc(0, 0, 116, 0, TAU);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(150,12,12,0.55)";
  ctx.stroke();
}

/** Three comma-shaped tomoe; `shrink` (0..1) tightens them as they morph away. */
function drawTomoe(ctx: CanvasRenderingContext2D, spin: number, shrink: number, alpha: number): void {
  const orbit = 100;
  const headR = 34 * (1 - 0.35 * shrink);
  const tailLen = 48 * (1 - 0.25 * shrink);
  ctx.fillStyle = "#000";
  ctx.globalAlpha = alpha;
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * TAU) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * orbit, Math.sin(a) * orbit, headR, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, orbit + tailLen, a + 0.32, a + 1.18);
    ctx.arc(0, 0, orbit - 9, a + 1.18, a + 0.32, true);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Three curved, tapering Mangekyō blades; `sweep` sets how far each curls and
 * `back` the radius of the inner edge's control point (lower = fatter blade).
 */
function drawBlades(ctx: CanvasRenderingContext2D, spin: number, sweep: number, alpha: number, back = 100): void {
  const inner = 58;
  const outer = 168;
  const mid1 = 132;
  const mid2 = back;
  ctx.fillStyle = "#000";
  ctx.globalAlpha = alpha;
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * TAU) / 3;
    ctx.beginPath();
    ctx.moveTo(...at(inner, a));
    ctx.quadraticCurveTo(...at(mid1, a + sweep * 0.35), ...at(outer, a + sweep));
    ctx.quadraticCurveTo(...at(mid2, a + sweep * 0.65), ...at(inner, a));
    ctx.closePath();
    ctx.fill();
  }
}

function drawPupil(ctx: CanvasRenderingContext2D, r = 34, color = "#000"): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

/**
 * Sharingan awakening as a seamless loop (t in [0,1), last frame flows into the first):
 *   0.00–0.18  three tomoe circle the pupil
 *   0.18–0.45  tomoe wind up and morph into the Mangekyō pinwheel
 *   0.45–0.72  pinwheel holds and turns, with an awakening flare
 *   0.72–0.97  pinwheel relaxes back into tomoe
 * Spin covers exactly one full turn per loop (3-fold symmetry), so nothing jumps.
 */
export function drawSharingan(ctx: CanvasRenderingContext2D, t: number): void {
  const windUp = smoothstep(0.18, 0.45, t);
  const morph = windUp * (1 - smoothstep(0.72, 0.97, t));
  const spin = t * ((TAU * 2) / 3) + windUp * (TAU / 3);

  drawSharinganIris(ctx);
  if (morph < 1) drawTomoe(ctx, spin, morph, 1 - morph);
  if (morph > 0) drawBlades(ctx, spin, 0.22 + 0.42 * morph, morph);

  const flare = Math.sin(smoothstep(0.38, 0.62, t) * Math.PI) * 0.55;
  if (flare > 0.02) {
    ctx.globalAlpha = flare;
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 185);
    fg.addColorStop(0, "rgba(255,230,210,0.9)");
    fg.addColorStop(0.5, "rgba(255,120,60,0.35)");
    fg.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, 185, 0, TAU);
    ctx.fill();
  }
  drawPupil(ctx);
}

/** The Mangekyō pinwheel spinning continuously, with a short motion trail. */
export function drawMangekyo(ctx: CanvasRenderingContext2D, t: number): void {
  const spin = (t * TAU) / 3; // one blade pitch per loop reads as endless rotation
  drawSharinganIris(ctx);

  // Glowing guideline that breathes once per loop.
  ctx.globalAlpha = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * TAU));
  ctx.strokeStyle = "#ff7a4d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 116, 0, TAU);
  ctx.stroke();

  for (let k = 3; k >= 1; k--) drawBlades(ctx, spin - k * 0.06, 0.9, 0.14 * (4 - k) * 0.5, 40);
  drawBlades(ctx, spin, 0.9, 1, 40);
  drawPupil(ctx);
}

// ------------------------------------------------------------------- Rinnegan

/** Concentric rings rippling outward; each ring slides into the next one's place. */
export function drawRinnegan(ctx: CanvasRenderingContext2D, t: number): void {
  const R = 210;
  const spacing = 34;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, "#e4daf5");
  g.addColorStop(0.5, "#a68fcf");
  g.addColorStop(0.85, "#6b519a");
  g.addColorStop(1, "#2c1d47");
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.clip();
  for (let k = 0; k < 8; k++) {
    const r = (k + t) * spacing + 14;
    const alpha = smoothstep(12, 44, r) * (1 - smoothstep(R - 34, R + 4, r));
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#1e1034";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalAlpha = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * TAU));
  const hl = ctx.createRadialGradient(-50, -60, 0, -50, -60, 150);
  hl.addColorStop(0, "#fff");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,10,35,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.stroke();
  drawPupil(ctx, 14, "#1e1034");
}

// ---------------------------------------------------------------------- Turbo

const TURBO_BLADES = 11;

function drawTurbineBlades(ctx: CanvasRenderingContext2D, spin: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#c7c7cc";
  ctx.strokeStyle = "#48484a";
  ctx.lineWidth = 2;
  for (let b = 0; b < TURBO_BLADES; b++) {
    const a = spin + (b * TAU) / TURBO_BLADES;
    ctx.beginPath();
    ctx.moveTo(...at(44, a - 0.09));
    ctx.quadraticCurveTo(...at(128, a + 0.02), ...at(196, a + 0.5));
    ctx.lineTo(...at(196, a + 0.36));
    ctx.quadraticCurveTo(...at(118, a + 0.2), ...at(44, a + 0.09));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** A compressor wheel at full boost, with motion blur behind each blade. */
export function drawTurbo(ctx: CanvasRenderingContext2D, t: number): void {
  const pitch = TAU / TURBO_BLADES;
  const spin = t * pitch; // one blade pitch per loop: small, even steps

  // Housing
  const housing = ctx.createRadialGradient(0, 0, 196, 0, 0, 236);
  housing.addColorStop(0, "#2c2c2e");
  housing.addColorStop(0.5, "#636366");
  housing.addColorStop(1, "#1c1c1e");
  ctx.globalAlpha = 1;
  ctx.fillStyle = housing;
  ctx.beginPath();
  ctx.arc(0, 0, 236, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#050507";
  ctx.beginPath();
  ctx.arc(0, 0, 200, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#8e8e93";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(...at(218, (i * TAU) / 12 + 0.13), 5, 0, TAU);
    ctx.fill();
  }

  // Heat in the bore
  const heat = ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
  heat.addColorStop(0, "rgba(255,140,60,0.35)");
  heat.addColorStop(0.6, "rgba(255,80,20,0.08)");
  heat.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = heat;
  ctx.beginPath();
  ctx.arc(0, 0, 200, 0, TAU);
  ctx.fill();

  for (let g = 4; g >= 1; g--) drawTurbineBlades(ctx, spin - g * pitch * 0.11, 0.16 * (1 - g / 5));
  drawTurbineBlades(ctx, spin, 1);

  // Hub and nut
  const hub = ctx.createRadialGradient(-12, -14, 4, 0, 0, 48);
  hub.addColorStop(0, "#f2f2f7");
  hub.addColorStop(0.6, "#8e8e93");
  hub.addColorStop(1, "#3a3a3c");
  ctx.globalAlpha = 1;
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#48484a";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const p = at(20, spin + (i * TAU) / 6);
    if (i === 0) ctx.moveTo(...p);
    else ctx.lineTo(...p);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------- Radar

const RADAR_BLIPS = [
  { a: 0.7, r: 120 },
  { a: 2.2, r: 172 },
  { a: 3.6, r: 78 },
  { a: 5.1, r: 150 },
];

/** One full sweep per loop with a fading trail; blips glow as the beam passes. */
export function drawRadar(ctx: CanvasRenderingContext2D, t: number): void {
  const R = 214;
  const green = "48,209,88";
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  bg.addColorStop(0, "#06210f");
  bg.addColorStop(1, "#010603");
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = `rgba(${green},0.28)`;
  ctx.lineWidth = 2;
  for (const f of [0.33, 0.66, 1]) {
    ctx.beginPath();
    ctx.arc(0, 0, R * f, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.moveTo(0, -R);
  ctx.lineTo(0, R);
  ctx.stroke();
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36;
    ctx.beginPath();
    ctx.moveTo(...at(R - (i % 3 === 0 ? 14 : 7), a));
    ctx.lineTo(...at(R, a));
    ctx.stroke();
  }

  const sweep = t * TAU - Math.PI / 2;
  const trail = 1.7;
  const slices = 48;
  for (let s = 0; s < slices; s++) {
    const a1 = sweep - (s * trail) / slices;
    const a0 = sweep - ((s + 1) * trail) / slices;
    ctx.globalAlpha = 0.62 * (1 - s / slices) ** 1.6;
    ctx.fillStyle = `rgb(${green})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a0, a1 + 0.004);
    ctx.closePath();
    ctx.fill();
  }

  for (const blip of RADAR_BLIPS) {
    const since = ((((sweep - blip.a) % TAU) + TAU) % TAU) / TAU;
    const glow = Math.exp(-since * 4.5);
    ctx.globalAlpha = 0.15 + 0.85 * glow;
    ctx.fillStyle = "#b4ffc8";
    ctx.shadowColor = `rgb(${green})`;
    ctx.shadowBlur = 18 * glow;
    ctx.beginPath();
    ctx.arc(...at(blip.r, blip.a), 8 + 5 * glow, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#a8ffbe";
  ctx.lineWidth = 3;
  ctx.shadowColor = `rgb(${green})`;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(...at(R, sweep));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a8ffbe";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  ctx.fill();
}

// ------------------------------------------------------------------ Rev meter

/** Engine load through one loop: idle → rev → limiter bounce → back to idle. */
function revLevel(t: number): number {
  const idle = 0.12;
  if (t < 0.08) return idle;
  if (t < 0.36) return idle + (1 - idle) * smoothstep(0.08, 0.36, t);
  if (t < 0.56) return 0.94 + 0.06 * Math.abs(Math.sin((t - 0.36) * Math.PI * 12));
  if (t < 0.86) return 1 - (1 - idle) * smoothstep(0.56, 0.86, t);
  return idle + 0.012 * Math.sin(t * TAU * 4);
}

/** A segmented tachometer that revs to a flashing redline and settles back. */
export function drawRevMeter(ctx: CanvasRenderingContext2D, t: number): void {
  const level = revLevel(t);
  const segs = 32;
  const start = Math.PI * 0.75;
  const span = Math.PI * 1.5;
  const limiter = level > 0.93;

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#1c1c1e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 224, 0, TAU);
  ctx.stroke();

  ctx.lineWidth = 32;
  for (let i = 0; i < segs; i++) {
    const f = (i + 1) / segs;
    const a = start + (i / segs) * span;
    const color = f <= 0.6 ? "#30d158" : f <= 0.84 ? "#ff9f0a" : "#ff453a";
    const lit = f <= level + 1e-6;
    ctx.globalAlpha = lit ? 1 : 0.12;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = lit ? 16 : 0;
    ctx.beginPath();
    ctx.arc(0, 0, 188, a + 0.012, a + span / segs - 0.012);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  if (limiter) {
    ctx.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin((t - 0.36) * Math.PI * 12));
    const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, 160);
    flash.addColorStop(0, "#ff453a");
    flash.addColorStop(1, "rgba(255,69,58,0)");
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = limiter ? "#ff6961" : "#fff";
  ctx.font = "900 104px Orbitron, sans-serif";
  ctx.fillText((level * 8).toFixed(1), 0, -6);
  ctx.fillStyle = "#8e8e93";
  ctx.font = "700 24px Orbitron, sans-serif";
  ctx.fillText("RPM ×1000", 0, 74);
}

// --------------------------------------------------------------- Plasma core

const CORE_RINGS = [
  { r: 92, w: 10, n: 6, fill: 0.62, dir: 1 },
  { r: 132, w: 8, n: 9, fill: 0.46, dir: -1 },
  { r: 172, w: 13, n: 4, fill: 0.82, dir: 1 },
  { r: 208, w: 5, n: 24, fill: 0.36, dir: -1 },
];

/** Counter-rotating segmented rings around a breathing core. */
export function drawPlasmaCore(ctx: CanvasRenderingContext2D, t: number): void {
  const cyan = "#64d2ff";
  const pulse = 0.5 + 0.5 * Math.sin(t * TAU);

  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 236);
  bg.addColorStop(0, "#00202c");
  bg.addColorStop(1, "#000");
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, 236, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(100,210,255,0.12)";
  ctx.lineWidth = 1.5;
  for (const ring of CORE_RINGS) {
    ctx.beginPath();
    ctx.arc(0, 0, ring.r, 0, TAU);
    ctx.stroke();
  }

  ctx.strokeStyle = cyan;
  ctx.shadowColor = cyan;
  ctx.shadowBlur = 18;
  ctx.lineCap = "butt";
  for (const ring of CORE_RINGS) {
    const pitch = TAU / ring.n;
    const rot = t * pitch * ring.dir; // one segment pitch per loop
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = ring.w;
    for (let j = 0; j < ring.n; j++) {
      const a = rot + j * pitch;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, a, a + pitch * ring.fill);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  const coreR = 62 + 12 * pulse;
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.35, "#c8f1ff");
  core.addColorStop(0.7, "rgba(100,210,255,0.55)");
  core.addColorStop(1, "rgba(100,210,255,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, coreR, 0, TAU);
  ctx.fill();
}
