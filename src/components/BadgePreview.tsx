import { Radio } from "lucide-react";
import { cn } from "../utils/cn";

interface BadgePreviewProps {
  faceUrl: string | null;
  brightness: number;
  size?: number;
  label?: string;
  connected?: boolean;
  scanning?: boolean;
  className?: string;
}

function ScanAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black">
      <div className="radar-ping absolute h-1/2 w-1/2 rounded-full border border-white/30" />
      <div className="radar-ping absolute h-3/4 w-3/4 rounded-full border border-white/15" style={{ animationDelay: "0.55s" }} />
      <div
        className="radar-sweep absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, rgba(255,255,255,0.18), transparent 22%)" }}
      />
      <Radio className="relative h-7 w-7 text-white/70" />
    </div>
  );
}

/** The badge as a physical object: polished aluminium ring around a round display. */
export function BadgePreview({ faceUrl, brightness, size = 220, label, connected, scanning, className }: BadgePreviewProps) {
  const filter = `brightness(${Math.max(0.08, brightness / 100)}) saturate(${0.7 + brightness / 200})`;

  return (
    <div className={cn("flex max-w-full flex-col items-center gap-3", className)}>
      <div className="bezel relative rounded-full p-[3.5%]" style={{ width: size, maxWidth: "100%", aspectRatio: "1 / 1" }}>
        <div className="relative h-full w-full overflow-hidden rounded-full bg-black shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.9)]">
          {scanning ? (
            <ScanAnimation />
          ) : faceUrl ? (
            <img
              src={faceUrl}
              alt="Badge display preview"
              className="h-full w-full object-cover transition-[filter] duration-300"
              style={{ filter }}
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[13px] text-label-3">Nothing playing</div>
          )}
          {/* Cover-glass reflection */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(155deg,rgba(255,255,255,0.10)_0%,transparent_38%)] shadow-[inset_0_0_28px_rgba(0,0,0,0.7)]" />
        </div>
        {connected !== undefined && (
          <span
            className={cn(
              "absolute right-[9%] bottom-[9%] h-2.5 w-2.5 rounded-full ring-2 ring-black",
              connected ? "bg-go shadow-[0_0_8px_rgba(48,209,88,0.8)]" : "bg-surface-3",
            )}
          />
        )}
      </div>
      {label && <p className="text-[13px] text-label-2">{label}</p>}
    </div>
  );
}
