import { useEffect, useRef, useState } from "react";
import { Sun, SunDim } from "lucide-react";
import { useBadge } from "../context/BadgeContext";

const PRESETS = [10, 30, 50, 75, 100];

/**
 * Slider that previews live and writes to the badge when the finger lifts,
 * so a drag costs one transfer instead of dozens.
 */
export function BrightnessControl({ presets = false }: { presets?: boolean }) {
  const { brightness, setBrightness, commitBrightness, connectionState } = useBadge();
  const connected = connectionState === "connected";
  const [value, setValue] = useState(brightness);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setValue(brightness);
  }, [brightness]);

  const release = () => {
    dragging.current = false;
    if (connected) void commitBrightness(value);
  };

  const slider = (
    <div className="flex items-center gap-3 px-4 py-3">
      <SunDim className="h-5 w-5 shrink-0 text-label-2" />
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label="Brightness"
        onPointerDown={() => (dragging.current = true)}
        onChange={(e) => {
          const v = Number(e.target.value);
          setValue(v);
          setBrightness(v);
        }}
        onPointerUp={release}
        onKeyUp={release}
        className="slider-track"
        style={{ ["--fill" as string]: `${value}%` }}
      />
      <Sun className="h-5 w-5 shrink-0 text-label-2" />
      <span className="w-10 shrink-0 text-right text-[15px] text-label-2 tabular-nums">{value}%</span>
    </div>
  );

  if (!presets) return slider;
  return (
    <>
      {slider}
      <div className="grid grid-cols-5 gap-2 px-4 pb-4">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setValue(p);
              setBrightness(p);
              if (connected) void commitBrightness(p);
            }}
            aria-pressed={value === p}
            className={
              "min-h-10 rounded-[10px] text-[14px] font-semibold tabular-nums transition active:scale-95 " +
              (value === p ? "bg-label text-black" : "bg-fill text-label hover:bg-fill-strong")
            }
          >
            {p}%
          </button>
        ))}
      </div>
    </>
  );
}
