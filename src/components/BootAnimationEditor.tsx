import { useRef, useState, useEffect } from "react";
import { Film, PlayCircle, Trash2, Upload, X, Sparkles } from "lucide-react";
import type { BLEManagerApi } from "../hooks/useBLEManager";
import { useFaceStorage } from "../hooks/useFaceStorage";
import { TransferProgressBar } from "./TransferProgress";
import { MAX_BOOT_FRAMES } from "../types";

export function BootAnimationEditor({ ble }: { ble: BLEManagerApi }) {
  const { bootFrames, addBootFrames, clearBootFrames, bootAnimEnabled, setBootAnim, uploadBootAnimation, transfer, cancelTransfer, connectionState } =
    ble;
  const { savedFaces } = useFaceStorage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopSpeed, setLoopSpeed] = useState(1000);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const disabled = connectionState !== "ready";
  const busy = transfer.phase !== "idle" && transfer.phase !== "complete" && transfer.phase !== "error" && transfer.phase !== "cancelled";

  useEffect(() => {
    if (!playing || bootFrames.length === 0) return;
    const t = window.setInterval(() => {
      setPreviewIdx((i) => (i + 1) % bootFrames.length);
    }, loopSpeed);
    return () => window.clearInterval(t);
  }, [playing, bootFrames.length, loopSpeed]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const room = MAX_BOOT_FRAMES - bootFrames.length;
    const toRead = files.slice(0, Math.max(0, room));
    Promise.all(
      toRead.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          })
      )
    ).then((dataUrls) => {
      addBootFrames(dataUrls.map((dataUrl) => ({ id: crypto.randomUUID(), dataUrl })));
    });
    if (e.target) e.target.value = "";
  };

  const addFromGallery = (dataUrl: string) => {
    if (bootFrames.length >= MAX_BOOT_FRAMES) return;
    addBootFrames([{ id: crypto.randomUUID(), dataUrl }]);
    setGalleryPickerOpen(false);
  };

  return (
    <div className="flex h-full flex-col px-5 py-6">
      <h2 className="text-lg font-semibold text-white">Startup animation</h2>
      <p className="text-xs text-zinc-500">Add up to {MAX_BOOT_FRAMES} frames.</p>

      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="relative h-40 w-40 overflow-hidden rounded-full ring-2 ring-blue-500/50">
          {bootFrames.length > 0 ? (
            <img src={bootFrames[previewIdx]?.dataUrl} className="h-full w-full object-cover" alt="frame preview" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-600">no frames yet</div>
          )}
        </div>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={bootFrames.length < 2}
          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-40"
        >
          <PlayCircle className="h-4 w-4" /> {playing ? "Pause preview loop" : "Preview loop"}
        </button>
        <p className="text-[11px] text-zinc-500">
          {bootFrames.length}/{MAX_BOOT_FRAMES} frames
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={bootFrames.length >= MAX_BOOT_FRAMES}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          <Film className="h-3.5 w-3.5" /> Add Frames / GIF
        </button>
        <button
          onClick={() => setGalleryPickerOpen(true)}
          disabled={savedFaces.length === 0 || bootFrames.length >= MAX_BOOT_FRAMES}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" /> From Gallery
        </button>
        <button
          onClick={clearBootFrames}
          disabled={bootFrames.length === 0}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <input ref={fileInput} type="file" accept="image/*,.gif" multiple className="hidden" onChange={onPick} />

      {bootFrames.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {bootFrames.map((f, i) => (
            <img
              key={f.id}
              src={f.dataUrl}
              onClick={() => setPreviewIdx(i)}
              className={`h-9 w-9 shrink-0 cursor-pointer rounded-full object-cover ring-2 ${
                previewIdx === i ? "ring-blue-500" : "ring-transparent"
              }`}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Custom boot sequence</p>
              <p className="text-[11px] text-zinc-500">Starts when the badge powers on</p>
            </div>
            <button
              onClick={() => setBootAnim(!bootAnimEnabled)}
              disabled={disabled}
              className={`h-6 w-11 rounded-full transition ${bootAnimEnabled ? "bg-blue-600" : "bg-zinc-700"} disabled:opacity-40`}
            >
              <span
                className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
                  bootAnimEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Loop speed</span>
              <span>{loopSpeed >= 60000 ? "1 min" : `${Math.round(loopSpeed / 1000)}s`}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={60000}
              step={1000}
              value={loopSpeed}
              disabled={disabled || bootFrames.length < 2}
              onChange={(e) => setLoopSpeed(Number(e.target.value))}
              className="w-full accent-blue-500 disabled:opacity-40"
            />
            <p className="text-[11px] text-zinc-500">Lower values play faster. Up to 1 minute.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <TransferProgressBar transfer={transfer} onCancel={cancelTransfer} />
        <button
          onClick={() => uploadBootAnimation(bootFrames)}
          disabled={disabled || busy || bootFrames.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          <Upload className="h-4 w-4" /> Upload animation
        </button>
        {disabled && (
          <p className="text-center text-[11px] text-amber-300">Connect to enable uploads.</p>
        )}
      </div>
      {galleryPickerOpen && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/60 px-4 pb-4 pt-12 backdrop-blur-sm">
          <div className="max-h-full w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Choose from Gallery</p>
                <p className="text-[11px] text-zinc-500">Pick a saved face to use in your startup animation.</p>
              </div>
              <button onClick={() => setGalleryPickerOpen(false)} className="rounded-full p-1.5 hover:bg-zinc-800">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-4">
              {savedFaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                  No saved faces yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {savedFaces.map((face) => (
                    <button
                      key={face.id}
                      onClick={() => addFromGallery(face.dataUrl)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-blue-500">
                        <img src={face.dataUrl} className="h-full w-full object-cover" alt={face.name} />
                      </div>
                      <span className="max-w-[72px] truncate text-[10px] text-zinc-400">{face.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
