import { useMemo } from "react";
import { cn } from "../utils/cn";

const SIZE = 480;
const CENTER = SIZE / 2;
const MAX_KMH = 240;
const SWEEP = 240;

const SPEED_ANGLE = -210;

function angleFor(kmh: number): number {
  return SPEED_ANGLE + (Math.min(Math.max(kmh, 0), MAX_KMH) / MAX_KMH) * SWEEP;
}

function polar(deg: number, radius: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function renderSpeedGaugeSvg(kmh: number, simulated: boolean): string {
  const clamped = Math.min(Math.max(kmh, 0), MAX_KMH);

  const ticks = Array.from({ length: 13 })
    .map((_, i) => {
      const v = i * 20;
      const angle = angleFor(v);
      const major = i % 2 === 0;
      const r1 = 208;
      const r2 = major ? 172 : 190;
      const [x1, y1] = polar(angle, r1);
      const [x2, y2] = polar(angle, r2);
      const hot = v >= 200;
      const color = hot ? "#f2635f" : "#e4e4e7";
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${major ? 7 : 3}" stroke-linecap="round"/>`;
    })
    .join("");

  const labels = [0, 40, 80, 120, 160, 200, 240]
    .map((v) => {
      const angle = angleFor(v);
      const [x, y] = polar(angle, 148);
      const hot = v >= 200;
      return `<text x="${x}" y="${y + 6}" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="700" font-size="20" fill="${hot ? "#f2635f" : "#a1a1aa"}">${v}</text>`;
    })
    .join("");

  const redStart = polar(angleFor(200), 196);
  const redEnd = polar(angleFor(240), 196);
  const redZone = `<path d="M ${redStart[0]} ${redStart[1]} A 196 196 0 0 1 ${redEnd[0]} ${redEnd[1]}" fill="none" stroke="#e8443e" stroke-width="26" opacity="0.28"/>`;

  const [nx, ny] = polar(angleFor(clamped), 168);
  const [tailX, tailY] = polar(angleFor(clamped) + 180, 34);

  const tag = simulated
    ? `<rect x="160" y="46" width="160" height="26" rx="13" fill="#e8443e" opacity="0.9"/><text x="240" y="64" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="2" fill="#0a0a0c">LIVE · DEMO</text>`
    : `<rect x="160" y="46" width="160" height="26" rx="13" fill="#22c55e" opacity="0.9"/><text x="240" y="64" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="2" fill="#0a0a0c">LIVE · GPS</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="speedBg" cx="50%" cy="55%" r="72%">
        <stop offset="0%" stop-color="#131722"/>
        <stop offset="100%" stop-color="#07080c"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#speedBg)"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="224" fill="#0a0c11" stroke="#23232c" stroke-width="8"/>
    ${redZone}
    ${ticks}
    ${labels}
    ${tag}
    <line x1="${tailX}" y1="${tailY}" x2="${nx}" y2="${ny}" stroke="#f97316" stroke-width="10" stroke-linecap="round"/>
    <line x1="${tailX}" y1="${tailY}" x2="${nx}" y2="${ny}" stroke="#ffd9a8" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="20" fill="#15151a" stroke="#f97316" stroke-width="5"/>
    <text x="${CENTER}" y="${CENTER + 116}" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-weight="900" font-size="52" fill="#f8fafc">${String(Math.round(clamped)).padStart(3, "0")}</text>
    <text x="${CENTER}" y="${CENTER + 148}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="4" fill="#a1a1aa">km/h</text>
  </svg>`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function speedGaugeDataUrl(kmh: number, simulated: boolean): string {
  return svgToDataUrl(renderSpeedGaugeSvg(kmh, simulated));
}

export function LiveGauge({
  kmh,
  simulated,
  size = 480,
  className,
}: {
  kmh: number;
  simulated: boolean;
  size?: number;
  className?: string;
}) {
  const src = useMemo(() => speedGaugeDataUrl(kmh, simulated), [kmh, simulated]);
  return (
    <img
      src={src}
      alt={`Speed gauge ${Math.round(kmh)} km/h`}
      className={cn("select-none", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
