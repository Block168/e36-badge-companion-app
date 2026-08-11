import { Bluetooth } from "lucide-react";
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
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-carbon-900">
      <div className="radar-ping absolute h-1/2 w-1/2 rounded-full border border-m-blue-500/60" />
      <div
        className="radar-ping absolute h-3/4 w-3/4 rounded-full border border-m-blue-400/40"
        style={{ animationDelay: "0.55s" }}
      />
      <div
        className="radar-sweep absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, rgba(47,111,214,0.4), transparent 22%)" }}
      />
      <Bluetooth className="relative h-8 w-8 text-m-blue-300 drop-shadow-[0_0_10px_rgba(79,143,224,0.8)]" />
    </div>
  );
}

export function BadgePreview({
  faceUrl,
  brightness,
  size = 220,
  label,
  connected,
  scanning,
  className,
}: BadgePreviewProps) {
  const filter = `brightness(${Math.max(0.08, brightness / 100)}) saturate(${0.7 + brightness / 200})`;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className="carbon relative rounded-full border-[6px] border-zinc-700 bg-black p-3 shadow-[0_0_0_2px_rgba(255,255,255,0.05),0_0_24px_rgba(47,111,214,0.25),0_20px_50px_-15px_rgba(0,0,0,0.8)]"
        style={{ width: size, height: size }}
      >
        <div className="absolute left-1/2 top-1.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-zinc-600" />
        <div className="relative h-full w-full overflow-hidden rounded-full bg-black ring-1 ring-white/10">
          {scanning ? (
            <ScanAnimation />
          ) : faceUrl ? (
            <img
              src={faceUrl}
              alt="Badge display preview"
              className="h-full w-full object-cover transition-[filter] duration-300"
              style={{ filter }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-xs text-zinc-500">
              No face loaded
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_30px_rgba(0,0,0,0.55)]" />
        </div>
        <div
          className={cn(
            "absolute bottom-1 right-4 h-2 w-2 rounded-full",
            connected ? "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" : "bg-zinc-600",
          )}
        />
      </div>
      {label && <p className="text-xs font-medium tracking-wide text-zinc-400">{label}</p>}
    </div>
  );
}
