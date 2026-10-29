import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, Plus, Square, Upload, WandSparkles } from "lucide-react";
import { PRESET_FACES } from "../data/presetFaces";
import { renderPresetFaceDataUrl } from "../lib/presetRender";
import { normalizeToDisplaySquare } from "../lib/imageEncode";
import { MAX_ANIMATION_FRAMES } from "../lib/protocol";
import { EFFECTS, generateEffectFrames, renderSignatureThumb, type EffectName } from "../lib/effects";
import { useBadge } from "../context/BadgeContext";
import { useAutomation } from "../context/AutomationContext";
import { BadgePreview } from "./BadgePreview";
import { NavBar, Row, Section, Toggle } from "./ui";
import { maxFramesThatFit } from "../lib/capacity";
import { cn } from "../utils/cn";
import type { AnimationFrame } from "../types";

const signatureEffects = EFFECTS.filter((e) => e.group === "signature");
const faceEffects = EFFECTS.filter((e) => e.group === "face");

const chip =
  "min-h-10 max-w-44 truncate rounded-full bg-fill px-4 text-[14px] font-medium whitespace-nowrap text-label transition active:scale-[0.96] hover:bg-fill-strong disabled:opacity-40";

/** The Studio: build an animation from faces, uploads and effects, then save or upload it. */
export function AnimationEditor({ onBack }: { onBack: () => void }) {
  const { connectionState, brightness, sendAnimation, customFaces, pushToast, badgeInfo } = useBadge();
  const { saveAnimation } = useAutomation();
  const connected = connectionState === "connected";
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("My Boot Animation");
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [processing, setProcessing] = useState(false);
  const [effectRunning, setEffectRunning] = useState<EffectName | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [marqueeText, setMarqueeText] = useState("E36");
  const [persist, setPersist] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signatureThumbs] = useState(() =>
    Object.fromEntries(signatureEffects.map((e) => [e.id, renderSignatureThumb(e.id, 192)])),
  );

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

  const addCustomFrame = useCallback(
    (face: { id: string; dataUrl: string }) => {
      addFrame({ id: crypto.randomUUID(), dataUrl: face.dataUrl, durationMs: 150 });
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
        const meta = EFFECTS.find((e) => e.id === effect);
        const generated = await generateEffectFrames(
          base,
          effect,
          meta?.frameCount ?? 8,
          meta?.frameDurationMs ?? 120,
          effect === "marquee" ? { text: marqueeText } : undefined,
        );
        setFrames((prev) => {
          const room = Math.max(0, MAX_ANIMATION_FRAMES - prev.length);
          return [...prev, ...generated.slice(0, room)];
        });
      } finally {
        setEffectRunning(null);
      }
    },
    [effectRunning, frames, marqueeText],
  );

  const setAllDurations = (durationMs: number) => {
    const clamped = Math.min(2000, Math.max(50, durationMs));
    setFrames((prev) => prev.map((f) => ({ ...f, durationMs: clamped })));
  };

  const clearFrames = () => setFrames([]);

  const totalMs = frames.reduce((total, frame) => total + frame.durationMs, 0);
  const avgDuration = frames.length > 0 ? totalMs / frames.length : 0;
  const fps = avgDuration > 0 ? 1000 / avgDuration : 0;

  const totalBytesEstimate = frames.length * 480 * 480 * 2;

  const handleSave = async () => {
    if (frames.length === 0) return;
    setSaving(true);
    try {
      await saveAnimation(name, frames);
      pushToast("success", `"${name}" saved to Library`);
    } catch (err) {
      console.error(err);
      pushToast("error", "Couldn't save the animation on this device");
    } finally {
      setSaving(false);
    }
  };

  const full = frames.length >= MAX_ANIMATION_FRAMES;
  // What the linked badge's free storage can hold right now.
  const badgeFits = connected ? maxFramesThatFit(badgeInfo) : MAX_ANIMATION_FRAMES;
  const tooBig = connected && frames.length > badgeFits;

  return (
    <div className="anim-push">
      <NavBar
        back="Library"
        onBack={onBack}
        title="Studio"
        trailing={
          <button onClick={() => void handleSave()} disabled={frames.length === 0 || saving} className="link-btn font-semibold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        }
      />

      <div className="mb-6 flex flex-col items-center gap-4">
        <BadgePreview
          faceUrl={frames[playIndex % Math.max(frames.length, 1)]?.dataUrl ?? null}
          brightness={connected ? brightness : 80}
          size={220}
          className="w-full max-w-[220px]"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Animation name"
          enterKeyHint="done"
          className="w-full max-w-sm rounded-[10px] bg-transparent px-3 py-1 text-center text-[22px] font-bold outline-none transition focus:bg-fill"
        />
        <p className="text-[15px] text-label-2 tabular-nums">
          <span>
            {frames.length}/{MAX_ANIMATION_FRAMES} frames · ~{(totalBytesEstimate / 1024).toFixed(0)} KB
          </span>
          {frames.length > 0 && <> · {(totalMs / 1000).toFixed(2)}s · {fps.toFixed(1)} fps</>}
        </p>
        {connected && badgeFits < MAX_ANIMATION_FRAMES && (
          <p className={cn("-mt-2 text-[13px]", tooBig ? "text-warn" : "text-label-2")}>
            {badgeFits === 0 ? "Badge storage is full" : `Your badge has room for ${badgeFits} frame${badgeFits === 1 ? "" : "s"}`}
          </p>
        )}
        <button onClick={() => setPlaying((p) => !p)} disabled={frames.length === 0} className="btn-secondary">
          {playing ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          {playing ? "Stop Preview" : "Play Preview"}
        </button>
      </div>

      <section className="mb-8">
        <div className="section-header">
          <span>Frames</span>
          {frames.length > 0 && (
            <button onClick={clearFrames} className="link-btn min-h-0 text-[15px] text-danger normal-case">
              Clear all
            </button>
          )}
        </div>
        <div className="list-group p-4">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={processing || full}
            className="btn-secondary mb-4 w-full"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
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
          <p className="mb-2 text-[13px] text-label-2">Quick-add a preset</p>
          <div className="scroll-strip mb-1">
            {PRESET_FACES.slice(0, 4).map((p) => (
              <button key={p.id} onClick={() => addPresetFrame(p.id)} disabled={full} className={chip}>
                {p.name}
              </button>
            ))}
          </div>
          {customFaces.length > 0 && (
            <>
              <p className="mt-3 mb-2 text-[13px] text-label-2">saved faces:</p>
              <div className="scroll-strip">
                {customFaces.slice(0, 8).map((f) => (
                  <button
                    key={f.id}
                    data-testid="animation-saved-face"
                    onClick={() => addCustomFrame(f)}
                    disabled={full}
                    className={cn(chip, "inline-flex items-center gap-2 pl-1.5")}
                  >
                    <img src={f.dataUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    {f.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="section-header">
          <span>Signature</span>
          <span className="normal-case">seamless loops</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {signatureEffects.map((effect) => (
            <button
              key={effect.id}
              onClick={() => void runEffect(effect.id)}
              disabled={effectRunning !== null || full}
              title={effect.description}
              className="group flex flex-col items-center gap-2 rounded-2xl bg-surface p-3 text-center transition active:scale-[0.97] hover:bg-surface-2 disabled:opacity-40"
            >
              <span className="relative block w-full max-w-[96px]">
                {signatureThumbs[effect.id] && (
                  <img
                    src={signatureThumbs[effect.id]!}
                    alt=""
                    draggable={false}
                    className="aspect-square w-full rounded-full ring-1 ring-white/10 transition duration-200 group-hover:ring-white/30"
                  />
                )}
                {effectRunning === effect.id && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-[14px] font-semibold">{effect.label}</span>
              <span className="-mt-1.5 text-[12px] text-label-2 tabular-nums">
                {effect.frameCount} frames · {(((effect.frameCount ?? 8) * (effect.frameDurationMs ?? 120)) / 1000).toFixed(1)}s
              </span>
            </button>
          ))}
        </div>
        <p className="section-footer">Drawn from scratch and added after your current frames. Each one loops with no visible jump.</p>
      </section>

      <section className="mb-8">
        <div className="section-header">
          <span>Face Effects</span>
          <span className="normal-case">applies to the last frame</span>
        </div>
        <div className="list-group p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {faceEffects.map((effect) => (
              <button
                key={effect.id}
                onClick={() => void runEffect(effect.id)}
                disabled={effectRunning !== null || full}
                title={effect.description}
                className="flex min-h-11 items-center gap-2 rounded-[10px] bg-fill px-3 text-left text-[14px] font-medium transition active:scale-[0.97] hover:bg-fill-strong disabled:opacity-40"
              >
                {effectRunning === effect.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <WandSparkles className="h-4 w-4 shrink-0 text-label-2" />
                )}
                <span className="truncate">{effect.label}</span>
              </button>
            ))}
          </div>
          <label htmlFor="marquee-text" className="mt-4 mb-2 block text-[13px] text-label-2">
            Marquee text
          </label>
          <input
            id="marquee-text"
            value={marqueeText}
            maxLength={24}
            onChange={(e) => setMarqueeText(e.target.value)}
            placeholder="E36 M3"
            enterKeyHint="done"
            autoCapitalize="characters"
            className="field uppercase"
          />
        </div>
        <p className="section-footer">
          Each effect adds a looping sequence built from the current face. Marquee replaces it with scrolling text.
        </p>
      </section>

      {frames.length > 0 && (
        <Section title="Timing">
          <Row
            title="Duration per frame"
            accessory={
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  enterKeyHint="done"
                  min={50}
                  max={2000}
                  step={10}
                  value={frames[0].durationMs}
                  onChange={(e) => setAllDurations(Number(e.target.value) || 150)}
                  aria-label="Duration per frame in milliseconds"
                  className="field min-h-9 w-20 text-right"
                />
                <span className="text-[15px] text-label-2">ms</span>
              </span>
            }
          />
          <Row title="Total length" detail={`${totalMs} ms`} />
        </Section>
      )}

      <Section footer="The badge keeps this animation after a restart and plays it on power-up.">
        <Row title="Keep after restart" accessory={<Toggle checked={persist} onChange={setPersist} label="Keep after restart" />} />
      </Section>

      <div className="action-dock-spacer" />
      <div className="action-dock">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{name}</p>
            <p className={cn("truncate text-[13px]", connected && !tooBig ? "text-label-2" : "text-warn")}>
              {!connected
                ? "Connect a badge to upload"
                : frames.length === 0
                  ? "Add frames to upload"
                  : tooBig
                    ? `Too big — badge fits ${badgeFits} frame${badgeFits === 1 ? "" : "s"}`
                    : `${frames.length} frames ready`}
            </p>
          </div>
          <button
            disabled={!connected || frames.length === 0 || tooBig}
            onClick={() => sendAnimation(frames, name, { persist })}
            className="btn-primary shrink-0 px-5"
          >
            <Upload className="h-4 w-4" />
            Upload Animation
          </button>
        </div>
      </div>
    </div>
  );
}
