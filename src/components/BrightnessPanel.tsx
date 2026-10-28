import { useEffect, useState } from "react";
import { Moon, Send, Sun } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { BadgePreview } from "./BadgePreview";
import { renderPresetFaceDataUrl } from "../lib/presetRender";
import { PRESET_FACES } from "../data/presetFaces";
import { cn } from "../utils/cn";

export function BrightnessPanel() {
  const { connectionState, brightness, setBrightness, commitBrightness } = useBadge();
  const connected = connectionState === "connected";
  const [localValue, setLocalValue] = useState(brightness);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalValue(brightness);
    setDirty(false);
  }, [brightness]);

  const previewFace = renderPresetFaceDataUrl(PRESET_FACES[0]);
  const presets = [10, 30, 50, 75, 100];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="card-track p-5 sm:p-8">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-amber-400" />
          <h3 className="font-display text-lg font-bold uppercase tracking-widest text-white">
            Display Brightness
          </h3>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Fine-tune your badge's display intensity. Changes are written live to the brightness characteristic.
        </p>

        <div className="mt-6 flex items-center gap-3 sm:mt-8 sm:gap-4">
          <Moon className="h-5 w-5 shrink-0 text-zinc-500" />
          <input
            type="range"
            min={0}
            max={100}
            value={localValue}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocalValue(v);
              setBrightness(v);
              setDirty(true);
            }}
            aria-label="Brightness"
            className="slider-track"
            style={{ ["--fill" as string]: `${localValue}%` }}
          />
          <Sun className="h-5 w-5 shrink-0 text-amber-400" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="font-display text-4xl font-black tabular-nums text-white">
            {String(localValue).padStart(3, "0")}
            <span className="ml-1 text-sm font-bold text-zinc-500">%</span>
          </span>
          <div className="grid w-full grid-cols-5 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setLocalValue(p);
                  setBrightness(p);
                  setDirty(true);
                }}
                aria-pressed={localValue === p}
                className={cn(
                  "chip min-h-11 justify-center border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.97] sm:min-h-0",
                  localValue === p && "border-m-blue-500 text-m-blue-300",
                )}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            disabled={!connected || !dirty}
            onClick={async () => {
              await commitBrightness(localValue);
              setDirty(false);
            }}
            className="btn-primary min-h-12 sm:min-h-0"
          >
            <Send className="h-4 w-4" />
            Apply to Badge
          </button>
          {!connected ? (
            <p className="text-xs text-amber-400/80">Connect a badge to write brightness changes over BLE.</p>
          ) : !dirty ? (
            <p className="text-xs text-zinc-500">Badge brightness is in sync with this slider.</p>
          ) : null}
        </div>
      </div>

      <div className="card-track order-first flex flex-col items-center justify-center gap-4 p-4 sm:p-6 lg:order-none">
        <h3 className="self-start font-display text-sm font-bold uppercase tracking-widest text-zinc-200">
          Live Preview
        </h3>
        <BadgePreview
          faceUrl={previewFace}
          brightness={localValue}
          connected={connected}
          size={200}
          className="w-full max-w-[160px] sm:max-w-none"
        />
        <p className="text-xs text-zinc-500">
          Roundel Glow <span className="font-display font-bold text-zinc-300">{localValue}%</span>
        </p>
      </div>
    </div>
  );
}
