import type { PresetFace } from "../types";

const SIZE = 480;
const CENTER = SIZE / 2;

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function roundelGlow(): string {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="#0b1220"/>
        <stop offset="100%" stop-color="#000000"/>
      </radialGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="14" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <g filter="url(#glow)">
      <circle cx="${CENTER}" cy="${CENTER}" r="170" fill="none" stroke="#3b82f6" stroke-width="10"/>
      <path d="M ${CENTER} ${CENTER - 160} A 160 160 0 0 1 ${CENTER + 160} ${CENTER} L ${CENTER} ${CENTER} Z" fill="#1d4ed8"/>
      <path d="M ${CENTER} ${CENTER + 160} A 160 160 0 0 1 ${CENTER - 160} ${CENTER} L ${CENTER} ${CENTER} Z" fill="#1d4ed8"/>
      <path d="M ${CENTER + 160} ${CENTER} A 160 160 0 0 1 ${CENTER} ${CENTER + 160} L ${CENTER} ${CENTER} Z" fill="#f8fafc"/>
      <path d="M ${CENTER - 160} ${CENTER} A 160 160 0 0 1 ${CENTER} ${CENTER - 160} L ${CENTER} ${CENTER} Z" fill="#f8fafc"/>
      <circle cx="${CENTER}" cy="${CENTER}" r="170" fill="none" stroke="#93c5fd" stroke-width="3"/>
    </g>
    <circle cx="${CENTER}" cy="${CENTER}" r="205" fill="none" stroke="#1e293b" stroke-width="6"/>
  </svg>`;
}

function checkeredFlag(): string {
  const cells = 10;
  const cell = SIZE / cells;
  let squares = "";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x + y) % 2 === 0) {
        squares += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#f8fafc"/>`;
      }
    }
  }
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" fill="#0f172a"/>
    <g transform="rotate(-8 ${CENTER} ${CENTER})">
      ${squares}
    </g>
    <circle cx="${CENTER}" cy="${CENTER}" r="230" fill="none" stroke="#0f172a" stroke-width="60"/>
  </svg>`;
}

function speedometer(): string {
  const ticks = Array.from({ length: 17 })
    .map((_, i) => {
      const angle = -220 + i * (260 / 16);
      const rad = (angle * Math.PI) / 180;
      const r1 = 190;
      const r2 = i % 4 === 0 ? 155 : 170;
      const x1 = CENTER + r1 * Math.cos(rad);
      const y1 = CENTER + r1 * Math.sin(rad);
      const x2 = CENTER + r2 * Math.cos(rad);
      const y2 = CENTER + r2 * Math.sin(rad);
      const color = i > 12 ? "#ef4444" : "#f8fafc";
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
    })
    .join("");
  const needleAngle = -220 + 11 * (260 / 16);
  const rad = (needleAngle * Math.PI) / 180;
  const nx = CENTER + 140 * Math.cos(rad);
  const ny = CENTER + 140 * Math.sin(rad);
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" fill="#0b0f14"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="210" fill="#111827" stroke="#1f2937" stroke-width="8"/>
    ${ticks}
    <line x1="${CENTER}" y1="${CENTER}" x2="${nx}" y2="${ny}" stroke="#f97316" stroke-width="8" stroke-linecap="round"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="16" fill="#f97316"/>
    <text x="${CENTER}" y="${CENTER + 90}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#f8fafc">km/h</text>
  </svg>`;
}

function flame(): string {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#7f1d1d"/>
        <stop offset="45%" stop-color="#ef4444"/>
        <stop offset="80%" stop-color="#f97316"/>
        <stop offset="100%" stop-color="#fde68a"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="#0a0a0a"/>
    <path d="M240 90 C170 170 140 230 160 300 C170 340 200 360 210 390 C170 370 120 320 130 260 C90 320 90 380 140 420 C190 460 300 460 340 400 C380 340 350 280 320 250 C330 290 310 310 300 300 C320 250 300 180 240 90 Z"
      fill="url(#flameGrad)"/>
    <path d="M240 200 C210 250 200 290 220 320 C230 335 250 345 250 360 C225 350 205 325 210 300 C185 335 190 370 220 390 C245 405 285 400 300 375 C315 350 300 325 285 315 C292 330 280 340 275 335 C285 305 275 260 240 200 Z"
      fill="#fde68a" opacity="0.85"/>
  </svg>`;
}

function carbonRing(): string {
  let lines = "";
  for (let i = -SIZE; i < SIZE * 2; i += 14) {
    lines += `<line x1="${i}" y1="0" x2="${i + SIZE}" y2="${SIZE}" stroke="#1e293b" stroke-width="6"/>`;
  }
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <clipPath id="clip"><rect width="${SIZE}" height="${SIZE}"/></clipPath>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="#0f172a"/>
    <g clip-path="url(#clip)" opacity="0.6">${lines}</g>
    <circle cx="${CENTER}" cy="${CENTER}" r="195" fill="none" stroke="#334155" stroke-width="16"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="195" fill="none" stroke="#94a3b8" stroke-width="2"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="150" fill="#0b1220" stroke="#475569" stroke-width="4"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="8" fill="#64748b"/>
  </svg>`;
}

function minimalClock(): string {
  const ticks = Array.from({ length: 12 })
    .map((_, i) => {
      const angle = i * 30;
      const rad = (angle * Math.PI) / 180;
      const r1 = 195;
      const r2 = 175;
      const x1 = CENTER + r1 * Math.sin(rad);
      const y1 = CENTER - r1 * Math.cos(rad);
      const x2 = CENTER + r2 * Math.sin(rad);
      const y2 = CENTER - r2 * Math.cos(rad);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>`;
    })
    .join("");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" fill="#f8fafc"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="210" fill="#ffffff" stroke="#e2e8f0" stroke-width="4"/>
    <g>${ticks}</g>
    <line x1="${CENTER}" y1="${CENTER}" x2="${CENTER + 60}" y2="${CENTER - 70}" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
    <line x1="${CENTER}" y1="${CENTER}" x2="${CENTER - 20}" y2="${CENTER + 110}" stroke="#0f172a" stroke-width="9" stroke-linecap="round"/>
    <line x1="${CENTER}" y1="${CENTER}" x2="${CENTER + 130}" y2="${CENTER + 40}" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="10" fill="#0f172a"/>
  </svg>`;
}

function tachometer(): string {
  const ticks = Array.from({ length: 17 })
    .map((_, i) => {
      const angle = -220 + i * (260 / 16);
      const rad = (angle * Math.PI) / 180;
      const r1 = 200;
      const r2 = i % 4 === 0 ? 160 : 178;
      const x1 = CENTER + r1 * Math.cos(rad);
      const y1 = CENTER + r1 * Math.sin(rad);
      const x2 = CENTER + r2 * Math.cos(rad);
      const y2 = CENTER + r2 * Math.sin(rad);
      const redline = i >= 13;
      const color = redline ? "#ef4444" : "#f8fafc";
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${i % 4 === 0 ? 7 : 3}" stroke-linecap="round"/>`;
    })
    .join("");
  const needleAngle = -220 + 13.5 * (260 / 16);
  const rad = (needleAngle * Math.PI) / 180;
  const nx = CENTER + 150 * Math.cos(rad);
  const ny = CENTER + 150 * Math.sin(rad);
  const redlineArc = `
    <path d="M ${CENTER + 178 * Math.cos(((-220 + 13 * (260 / 16)) * Math.PI) / 180)} ${CENTER + 178 * Math.sin(((-220 + 13 * (260 / 16)) * Math.PI) / 180)}
      A 178 178 0 0 1 ${CENTER + 178 * Math.cos(((-220 + 16 * (260 / 16)) * Math.PI) / 180)} ${CENTER + 178 * Math.sin(((-220 + 16 * (260 / 16)) * Math.PI) / 180)}"
      fill="none" stroke="#ef4444" stroke-width="22" opacity="0.35"/>`;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="tachBg" cx="50%" cy="55%" r="70%">
        <stop offset="0%" stop-color="#11141c"/>
        <stop offset="100%" stop-color="#07070a"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#tachBg)"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="222" fill="#0a0c11" stroke="#1f2937" stroke-width="8"/>
    ${redlineArc}
    ${ticks}
    <line x1="${CENTER}" y1="${CENTER}" x2="${nx}" y2="${ny}" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="18" fill="#111827" stroke="#ef4444" stroke-width="4"/>
    <text x="${CENTER}" y="${CENTER - 130}" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="800" font-size="42" fill="#f8fafc">RPM</text>
    <text x="${CENTER}" y="${CENTER + 92}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#f8fafc">×1000</text>
    <text x="${CENTER}" y="${CENTER + 132}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="6" fill="#ef4444">REDLINE</text>
  </svg>`;
}

function boostGauge(): string {
  const ticks = Array.from({ length: 16 })
    .map((_, i) => {
      const angle = -220 + i * (260 / 15);
      const rad = (angle * Math.PI) / 180;
      const r1 = 200;
      const r2 = i % 5 === 0 ? 160 : 178;
      const x1 = CENTER + r1 * Math.cos(rad);
      const y1 = CENTER + r1 * Math.sin(rad);
      const x2 = CENTER + r2 * Math.cos(rad);
      const y2 = CENTER + r2 * Math.sin(rad);
      const hot = i >= 12;
      const color = hot ? "#22d3ee" : "#f8fafc";
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${i % 5 === 0 ? 7 : 3}" stroke-linecap="round"/>`;
    })
    .join("");
  const needleAngle = -220 + 12.5 * (260 / 15);
  const rad = (needleAngle * Math.PI) / 180;
  const nx = CENTER + 150 * Math.cos(rad);
  const ny = CENTER + 150 * Math.sin(rad);
  const labels = ["-1.0", "-0.5", "0", "0.5", "1.0", "1.5", "2.0"];
  const labelText = labels
    .map((label, i) => {
      const angle = -220 + i * (260 / 15);
      const a = (angle * Math.PI) / 180;
      return `<text x="${CENTER + 132 * Math.cos(a)}" y="${CENTER + 132 * Math.sin(a) + 7}" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-size="17" fill="#94a3b8">${label}</text>`;
    })
    .join("");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="boostBg" cx="50%" cy="55%" r="70%">
        <stop offset="0%" stop-color="#0a1418"/>
        <stop offset="100%" stop-color="#05080a"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#boostBg)"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="222" fill="#080d10" stroke="#164e63" stroke-width="8"/>
    ${ticks}
    ${labelText}
    <line x1="${CENTER}" y1="${CENTER}" x2="${nx}" y2="${ny}" stroke="#22d3ee" stroke-width="9" stroke-linecap="round"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="18" fill="#0a1a20" stroke="#22d3ee" stroke-width="4"/>
    <text x="${CENTER}" y="${CENTER - 130}" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="800" font-size="42" fill="#22d3ee" letter-spacing="4">BOOST</text>
    <text x="${CENTER}" y="${CENTER + 95}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#f8fafc">bar</text>
    <circle cx="${CENTER - 70}" cy="${CENTER + 128}" r="6" fill="#22d3ee"/>
    <text x="${CENTER - 54}" y="${CENTER + 133}" font-family="Arial, sans-serif" font-size="16" fill="#94a3b8">turbo</text>
  </svg>`;
}

function racingStripes(): string {
  const stripeW = 74;
  const gap = 54;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="stripeBg" cx="50%" cy="45%" r="80%">
        <stop offset="0%" stop-color="#17171d"/>
        <stop offset="100%" stop-color="#08080b"/>
      </radialGradient>
      <linearGradient id="stripeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#c42822"/>
        <stop offset="50%" stop-color="#e8443e"/>
        <stop offset="100%" stop-color="#a51f1b"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#stripeBg)"/>
    <rect x="${CENTER - stripeW - gap}" y="0" width="${stripeW}" height="${SIZE}" fill="url(#stripeGrad)"/>
    <rect x="${CENTER + gap}" y="0" width="${stripeW}" height="${SIZE}" fill="url(#stripeGrad)"/>
    <rect x="${CENTER - stripeW - gap}" y="0" width="${stripeW}" height="${SIZE}" fill="none" stroke="#7fb2f0" stroke-width="3" opacity="0.55"/>
    <rect x="${CENTER + gap}" y="0" width="${stripeW}" height="${SIZE}" fill="none" stroke="#7fb2f0" stroke-width="3" opacity="0.55"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="62" fill="#0b0b0e" stroke="#e8443e" stroke-width="6"/>
    <text x="${CENTER}" y="${CENTER + 26}" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="900" font-size="44" fill="#f8fafc">E36</text>
    <text x="${CENTER}" y="${CENTER + 68}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="4" fill="#94a3b8">MOTORSPORT</text>
  </svg>`;
}

function kidneyGrille(): string {
  const slats = Array.from({ length: 6 })
    .map((_, i) => {
      const y = 175 + i * 42;
      return `<line x1="118" y1="${y}" x2="170" y2="${y}" stroke="#0b0b0e" stroke-width="5"/>`;
    })
    .join("");
  const slats2 = Array.from({ length: 6 })
    .map((_, i) => {
      const y = 175 + i * 42;
      return `<line x1="310" y1="${y}" x2="362" y2="${y}" stroke="#0b0b0e" stroke-width="5"/>`;
    })
    .join("");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="grilleGlow" cx="50%" cy="50%" r="62%">
        <stop offset="0%" stop-color="#123059"/>
        <stop offset="100%" stop-color="#06070a"/>
      </radialGradient>
      <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#94a3b8"/>
        <stop offset="45%" stop-color="#e2e8f0"/>
        <stop offset="55%" stop-color="#64748b"/>
        <stop offset="100%" stop-color="#334155"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#grilleGlow)"/>
    <g stroke="url(#chrome)" stroke-width="12" fill="#05060a">
      <rect x="96" y="150" width="96" height="240" rx="40" ry="52"/>
      <rect x="288" y="150" width="96" height="240" rx="40" ry="52"/>
    </g>
    ${slats}
    ${slats2}
    <text x="${CENTER}" y="120" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="800" font-size="26" letter-spacing="8" fill="#7fb2f0">TWIN TURBO</text>
    <text x="${CENTER}" y="432" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" letter-spacing="5" fill="#475569">THE DOUBLE KIDNEY</text>
  </svg>`;
}

function gearFace(): string {
  const lights = Array.from({ length: 6 })
    .map((_, i) => {
      const x = CENTER - 100 + i * 40;
      const lit = i < 5;
      const color = i < 3 ? "#a3e635" : i < 5 ? "#e8443e" : "#1f2937";
      return `<rect x="${x}" y="358" width="26" height="12" rx="6" fill="${lit ? color : "#1f2937"}"/>
        ${lit ? `<circle cx="${x + 13}" cy="352" r="2.5" fill="${color}"/>` : ""}`;
    })
    .join("");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="gearBg" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stop-color="#14170d"/>
        <stop offset="100%" stop-color="#060705"/>
      </radialGradient>
      <linearGradient id="gearNum" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f2f6e8"/>
        <stop offset="100%" stop-color="#a3b18a"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#gearBg)"/>
    <text x="${CENTER}" y="330" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="900" font-size="300" fill="url(#gearNum)" style="filter: drop-shadow(0 0 26px rgba(163,230,53,0.28));">6</text>
    ${lights}
    <text x="${CENTER}" y="416" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="700" font-size="20" letter-spacing="8" fill="#a3e635">SHIFT IT</text>
  </svg>`;
}

function trackMap(): string {
  const track = `
    <path d="M 96 150 C 96 78 210 70 250 110 C 300 40 420 70 420 150 C 420 200 372 210 348 246 C 330 274 340 300 400 316 C 460 332 440 410 360 410 C 300 410 300 360 250 360 C 200 360 200 414 140 414 C 78 414 60 340 120 316 C 176 294 160 254 130 232 C 100 210 96 190 96 150 Z"
    fill="#0f1216" stroke="#334155" stroke-width="10"/>
    <path d="M 96 150 C 96 78 210 70 250 110 C 300 40 420 70 420 150 C 420 200 372 210 348 246 C 330 274 340 300 400 316 C 460 332 440 410 360 410 C 300 410 300 360 250 360 C 200 360 200 414 140 414 C 78 414 60 340 120 316 C 176 294 160 254 130 232 C 100 210 96 190 96 150 Z"
    fill="none" stroke="#0f1216" stroke-width="4" stroke-dasharray="4 22" stroke-linecap="round"/>
    <path d="M 96 150 C 96 78 210 70 250 110 C 300 40 420 70 420 150 C 420 200 372 210 348 246 C 330 274 340 300 400 316 C 460 332 440 410 360 410 C 300 410 300 360 250 360 C 200 360 200 414 140 414 C 78 414 60 340 120 316 C 176 294 160 254 130 232 C 100 210 96 190 96 150 Z"
    fill="none" stroke="#60a5fa" stroke-width="3" opacity="0.7"/>
    <rect x="120" y="212" width="20" height="34" fill="#e8443e" transform="rotate(8 130 229)"/>
    <rect x="142" y="212" width="14" height="34" fill="#f8fafc" transform="rotate(8 149 229)"/>`;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="trackBg" cx="50%" cy="46%" r="78%">
        <stop offset="0%" stop-color="#0d1420"/>
        <stop offset="100%" stop-color="#06080c"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#trackBg)"/>
    ${track}
    <text x="${CENTER}" y="90" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="800" font-size="30" letter-spacing="6" fill="#f8fafc">NORDSCHELEIFE</text>
    <text x="${CENTER}" y="118" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="5" fill="#64748b">12.9 KM · 73 CORNERS</text>
  </svg>`;
}

const RENDERERS: Record<string, () => string> = {
  "roundel-glow": roundelGlow,
  "checkered-flag": checkeredFlag,
  speedometer,
  flame,
  "carbon-ring": carbonRing,
  "minimal-clock": minimalClock,
  tachometer,
  "boost-gauge": boostGauge,
  "racing-stripes": racingStripes,
  "kidney-grille": kidneyGrille,
  gear: gearFace,
  "track-map": trackMap,
};

export function renderPresetFaceDataUrl(face: PresetFace): string {
  const renderer = RENDERERS[face.id];
  const svg = renderer ? renderer() : roundelGlow();
  return svgToDataUrl(svg);
}
