import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { normalizeToDisplaySquare } from "../lib/imageEncode";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";

export function FaceUploader() {
  const { addCustomFace, pushToast } = useBadge();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        pushToast("error", "Please choose an image file (PNG, JPG, GIF, WEBP)");
        return;
      }
      setProcessing(true);
      try {
        const reader = new FileReader();
        const raw = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const normalized = await normalizeToDisplaySquare(raw);
        addCustomFace({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, "").slice(0, 40) || "Custom Face",
          dataUrl: normalized,
          createdAt: Date.now(),
        });
        pushToast("success", "Face added — cropped & scaled to 480×480");
      } catch (err) {
        pushToast("error", "Couldn't process that image");
        console.error(err);
      } finally {
        setProcessing(false);
      }
    },
    [addCustomFace, pushToast],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
        dragOver ? "border-m-blue-500 bg-m-blue-500/10" : "border-zinc-700 bg-zinc-950/40",
      )}
    >
      {processing ? (
        <Loader2 className="h-8 w-8 animate-spin text-m-blue-400" />
      ) : (
        <UploadCloud className="h-8 w-8 text-zinc-500" />
      )}
      <div>
        <p className="text-sm font-medium text-zinc-300">Drag & drop an image here</p>
        <p className="text-xs text-zinc-500">or click below to browse your files</p>
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={processing}
        className="btn-ghost !px-3 !py-1.5 !text-xs"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        Choose Image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
