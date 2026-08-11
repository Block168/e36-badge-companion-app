import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Film, Loader2, Play, Plus, Send, Square, Trash2, Wand2 } from "lucide-react";
import { PRESET_FACES } from "../data/presetFaces";
import { renderPresetFaceDataUrl } from "../lib/presetRender";
import { normalizeToDisplaySquare } from "../lib/imageEncode";
import { MAX_ANIMATION_FRAMES } from "../lib/protocol";
import { EFFECTS, generateEffectFrames, type EffectName } from "../lib/effects";
import { useBadge } from "../context/BadgeContext";
import { BadgePreview } from "./BadgePreview";
import type { AnimationFrame } from "../types";

export function AnimationEditor() {
  const { connectionState, brightness, sendAnimation } = useBadge();
  const connected = connectionState === "connected";
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("My Boot Animation");
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [processing, setProcessing] = useState(false);
  const [effectRunning, setEffectRunning] = useState<EffectName | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const frame = frames[playIndex % frames.length];
    const timeout = setTimeout(() => {
      setPlayIndex((i) => (i + 1) % frames.length);
    }, Math.max(50, frame.durationMs));
    return () => clearTimeout(timeout);
  }, [playing, playIndex, frames]);

  useEffect(() => {
    if (frames.length === 0) setPlaying(false);
  }, [frames.length]);

  const addFrame = useCallback((frame: AnimationFrame) => {
    setFrames((prev) => {
      if (prev.length >= MAX_ANIMATION_FRAMES) return prev;
      return [...prev, frame];
    });
  }, []);

  const addPresetFrame = useCallback(
    (presetId: string) => {
      const preset = PRESET_FACES.find((p) => p.id === presetId);
      if (!preset) return;
      addFrame({ id: crypto.randomUUID(), dataUrl: renderPresetFaceDataUrl(preset), durationMs: 150 });
    },
    [addFrame],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setProcessing(true);
      try {
        const reader = new FileReader();
        const raw = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const normalized = await normalizeToDisplaySquare(raw);
        addFrame({ id: crypto.randomUUID(), dataUrl: normalized, durationMs: 150 });
      } finally {
        setProcessing(false);
      }
    },
    [addFrame],
  );

  const runEffect = useCallback(
    async (effect: EffectName) => {
      if (effectRunning) return;
      let base = renderPresetFaceDataUrl(PRESET_FACES[0]);
      for (let i = frames.length - 1; i >= 0; i--) {
        if (!frames[i].dim) {
          base = frames[i].dataUrl;
          break;
        }
      }
      setEffectRunning(effect);
      try {
        const generated = await generateEffectFrames(base, effect, 8, 120);
        setFrames((prev) => {
          const room = Math.max(0, MAX_ANIMATION_FRAMES - prev.length);
          return [...prev, ...generated.slice(0, room)];
        });
      } finally {
        setEffectRunning(null);
      }
    },
    [effectRunning, frames],
  );

  const moveFrame = (index: number, dir: -1 | 1) => {
    setFrames((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
  };

  const updateDuration = (id: string, durationMs: number) => {
    setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, durationMs } : f)));
  };

  const totalBytesEstimate = frames.length * 480 * 480 * 2;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
      <div className="space-y-5">
        <div className="card-track p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-m-blue-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-transparent bg-transparent px-1 font-display text-base font-bold uppercase tracking-wide text-white outline-none transition focus:border-zinc-700 focus:bg-zinc-950 focus:px-2 focus:py-1"
              />
            </div>
            <span className="font-display text-xs font-bold uppercase tracking-widest text-zinc-500">
              {frames.length}/{MAX_ANIMATION_FRAMES} frames · ~{(totalBytesEstimate / 1024).toFixed(0)} KB
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={processing || frames.length >= MAX_ANIMATION_FRAMES}
              className="btn-ghost !px-3 !py-1.5 !text-xs"
            >
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Upload Frame
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <span className="text-xs text-zinc-600">or quick-add a preset:</span>
            {PRESET_FACES.slice(0, 4).map((p) => (
              <button
                key={p.id}
                onClick={() => addPresetFrame(p.id)}
                disabled={frames.length >= MAX_ANIMATION_FRAMES}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card-track p-5">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-m-red-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-200">
              Quick Effects
            </h3>
            <span className="text-[11px] text-zinc-600">applies to the last frame</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EFFECTS.map((effect) => (
              <button
                key={effect.id}
                onClick={() => void runEffect(effect.id)}
                disabled={effectRunning !== null}
                className="btn-ghost !px-3 !py-2"
                title={effect.description}
              >
                {effectRunning === effect.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5 text-m-blue-400" />
                )}
                <span className="font-display text-[11px] font-bold uppercase tracking-wide">{effect.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-600">
            Generates an 8-frame looping sequence from the current face — blink, breathe, wipe, or spin. Perfect for
            boot animations.
          </p>
        </div>

        <div className="card-track p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-200">Frames</h3>
          {frames.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
              No frames yet — upload an image or quick-add a preset above to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {frames.map((frame, index) => (
                <li
                  key={frame.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5"
                >
                  <span className="w-5 text-center text-xs font-semibold text-zinc-500">{index + 1}</span>
                  <img
                    src={frame.dataUrl}
                    alt={`Frame ${index + 1}`}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wide text-zinc-500">Duration (ms)</label>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      step={10}
                      value={frame.durationMs}
                      onChange={(e) => updateDuration(frame.id, Number(e.target.value) || 150)}
                      className="mt-0.5 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-white outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveFrame(index, -1)}
                      disabled={index === 0}
                      className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveFrame(index, 1)}
                      disabled={index === frames.length - 1}
                      className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFrame(frame.id)}
                    className="rounded-md p-1.5 text-red-400/70 hover:bg-red-950/50 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="card-track h-fit space-y-4 p-5 lg:sticky lg:top-20">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-200">Playback Preview</h3>
        <BadgePreview
          faceUrl={frames[playIndex % Math.max(frames.length, 1)]?.dataUrl ?? null}
          brightness={connected ? brightness : 55}
          connected={connected}
          size={200}
          className="mx-auto"
        />
        <div className="space-y-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={frames.length === 0}
            className="btn-ghost w-full"
          >
            {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Stop Preview" : "Play Preview"}
          </button>
          {frames.length > 0 && (
            <div className="text-sm text-zinc-400">
              <div className="flex items-center justify-between">
                <span>Duration:</span>
                <span>
                  {frames.reduce((total, frame) => total + frame.durationMs, 0)}ms
                  ({(
                    frames.reduce((total, frame) => total + frame.durationMs, 0) /
                    1000
                  ).toFixed(2)}s)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Effective FPS:</span>
                <span>
                  {frames.length > 0 ? (
                    1000 /
                      (frames.reduce((total, frame) => total + frame.durationMs, 0) /
                        frames.length)
                  ).toFixed(1) : "0"}
                </span>
              </div>
            </div>
          )}
        </div>
        <button
          disabled={!connected || frames.length === 0}
          onClick={() => sendAnimation(frames, name)}
          className="btn-primary w-full"
        >
          <Send className="h-4 w-4" />
          Upload Animation
        </button>
        {!connected && <p className="text-center text-xs text-amber-400/80">Connect a badge to enable transfers.</p>}
      </aside>
    </div>
  );
}
