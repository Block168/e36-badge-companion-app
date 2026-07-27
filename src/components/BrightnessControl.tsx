import { Sun, SunDim } from "lucide-react";
import type { BLEManagerApi } from "../hooks/useBLEManager";

export function BrightnessControl({ ble }: { ble: BLEManagerApi }) {
  const { brightness, setBrightness, connectionState, pendingByteWrite } = ble;
  const disabled = connectionState !== "ready";

  return (
    <div className="flex h-full flex-col px-5 py-6">
      <h2 className="text-lg font-semibold text-white">Lighting</h2>
      <p className="text-xs text-zinc-500">Set how bright the display should be.</p>

      <div className="mt-8 flex flex-col items-center">
        <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-4 border-zinc-800">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(#3b82f6 ${brightness * 3.6}deg, transparent ${brightness * 3.6}deg)`,
              mask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
            }}
          />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{brightness}%</p>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-3">
        <SunDim className="h-4 w-4 text-zinc-500" />
        <input
          type="range"
          min={0}
          max={100}
          value={brightness}
          disabled={disabled}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full accent-blue-500 disabled:opacity-40"
        />
        <Sun className="h-4 w-4 text-zinc-300" />
      </div>

      {disabled && (
        <p className="mt-4 rounded-lg bg-amber-950/60 px-3 py-2 text-[11px] text-amber-300">
          Connect to adjust brightness.
        </p>
      )}
    </div>
  );
}
