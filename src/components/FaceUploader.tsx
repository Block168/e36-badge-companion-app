import { useCallback, useRef, useState } from "react";
import { normalizeToDisplaySquare } from "../lib/imageEncode";
import { useBadge } from "../context/BadgeContext";

/** Image picker that crops/scales to the badge's 480×480 display and saves to the Library. */
export function useFaceUpload() {
  const { addCustomFace, pushToast } = useBadge();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        pushToast("error", "Please choose an image file (PNG, JPG, GIF, WEBP)");
        return;
      }
      setProcessing(true);
      try {
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
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
        pushToast("success", "Face added to Library");
      } catch (err) {
        pushToast("error", "Couldn't process that image");
        console.error(err);
      } finally {
        setProcessing(false);
      }
    },
    [addCustomFace, pushToast],
  );

  const input = (
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
  );

  return { input, pick: () => inputRef.current?.click(), handleFile, processing };
}
