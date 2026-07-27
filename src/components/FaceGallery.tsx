import { Check, Sparkles, Search, Folder, X, Loader2, AlertCircle } from "lucide-react";
import { PRESET_FACES } from "../data/faces";
import type { BLEManagerApi } from "../hooks/useBLEManager";
import { useFaceStorage } from "../hooks/useFaceStorage";
import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

type SavedFaceStatus = "idle" | "sending" | "sent" | "error";

export function FaceGallery({ ble, onOpenUploader }: { ble: BLEManagerApi; onOpenUploader: () => void }) {
  const { selectedFace, selectFace, connectionState } = ble;
  const { savedFaces, deleteFace, storageError, clearStorageError } = useFaceStorage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSavedFaceId, setSelectedSavedFaceId] = useState<string | null>(null);
  const [savedFaceStatus, setSavedFaceStatus] = useState<Record<string, SavedFaceStatus>>({});
  const disabled = connectionState !== "ready";

  const activePreview =
    (selectedSavedFaceId ? savedFaces.find((f) => f.id === selectedSavedFaceId)?.dataUrl : null) ??
    PRESET_FACES.find((f) => f.index === selectedFace)?.image;

  const categories = Array.from(new Set(savedFaces.map((f) => f.category).filter(Boolean))) as string[];
  
  const filteredSavedFaces = savedFaces.filter((face) => {
    const matchesSearch = face.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || face.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSavedFaceTap = (face: typeof savedFaces[number]) => {
    setSelectedSavedFaceId(face.id);
    if (connectionState !== "ready") {
      // Not connected: just preview locally until the badge is online.
      return;
    }
    if (savedFaceStatus[face.id] === "sending") return; // ignore double-tap
    setSavedFaceStatus((s) => ({ ...s, [face.id]: "sending" }));
    ble.uploadCustomFace(face.name, face.dataUrl);
  };

  // Watch the in-flight transfer to mark the saved face as sent/failed.
  useEffect(() => {
    if (!selectedSavedFaceId) return;
    const phase = ble.transfer.phase;
    if (phase !== "complete" && phase !== "error" && phase !== "cancelled") return;
    setSavedFaceStatus((s) => {
      const was = s[selectedSavedFaceId];
      if (was !== "sending") return s;
      return { ...s, [selectedSavedFaceId]: phase === "complete" ? "sent" : "error" };
    });
  }, [ble.transfer.phase, ble.transfer.bytesSent, selectedSavedFaceId]);

  // Auto-clear the "sent" badge after a few seconds so the gallery stays clean.
  useEffect(() => {
    const ids = Object.entries(savedFaceStatus).filter(([, v]) => v === "sent" || v === "error").map(([k]) => k);
    if (ids.length === 0) return;
    const t = window.setTimeout(() => {
      setSavedFaceStatus((s) => {
        const next = { ...s };
        for (const id of ids) delete next[id];
        return next;
      });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [savedFaceStatus]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Gallery</h2>
          <p className="text-xs text-zinc-500">Tap a design to apply it.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search designs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 pl-8 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-medium transition-colors",
              selectedCategory === null
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-medium transition-colors",
                selectedCategory === category
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              )}
            >
              <Folder className="h-3 w-3" />
              {category}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-blue-500/60">
          {activePreview ? (
            <img src={activePreview} className="h-full w-full object-cover" alt="Live preview" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] text-zinc-500">
              no face
            </div>
          )}
        </div>
        <div className="text-xs text-zinc-400">
          <p className="font-medium text-zinc-200">Live 480×480 circular preview</p>
          <p className="mt-0.5">Matches the badge's round IPS display shape 1:1.</p>
        </div>
      </div>

      {disabled && (
        <p className="mt-3 rounded-lg bg-amber-950/60 px-3 py-2 text-[11px] text-amber-300">
          Connect to use face selection.
        </p>
      )}

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Featured</p>
      <div className="grid grid-cols-3 gap-3">
        {PRESET_FACES.map((face) => (
          <button
            key={face.index}
            disabled={disabled}
            onClick={() => selectFace(face.index)}
            className="group relative flex flex-col items-center gap-1.5 disabled:opacity-50"
          >
            <div
              className={cn(
                "relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition",
                selectedFace === face.index ? "ring-blue-500" : "ring-transparent group-hover:ring-zinc-700"
              )}
            >
              <img src={face.image} className="h-full w-full object-cover" alt={face.name} />
              {selectedFace === face.index && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Check className="h-6 w-6 text-white drop-shadow" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-zinc-400">{face.name}</span>
          </button>
        ))}
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">My Faces</p>
        <button
          onClick={onOpenUploader}
          className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
        >
          <Sparkles className="h-3.5 w-3.5" /> New
        </button>
      </div>

      {storageError && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-950/40 p-2.5 text-[11px] text-amber-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{storageError}</span>
          <button onClick={clearStorageError} className="text-amber-300 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {filteredSavedFaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center">
          <p className="text-xs text-zinc-500">
            {savedFaces.length === 0 ? "No saved faces yet. Upload one to get started!" : "No faces match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filteredSavedFaces.map((face) => {
            const status = savedFaceStatus[face.id];
            return (
              <div key={face.id} className="flex flex-col items-center gap-1.5">
                <button
                  disabled={status === "sending"}
                  onClick={() => handleSavedFaceTap(face)}
                  title={
                    connectionState !== "ready"
                      ? "Preview only — connect to the badge to send"
                      : "Tap to send to badge"
                  }
                  className={cn(
                    "relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition disabled:opacity-60",
                    selectedSavedFaceId === face.id ? "ring-blue-500" : "ring-transparent hover:ring-zinc-700"
                  )}
                >
                  <img src={face.dataUrl} className="h-full w-full object-cover" alt={face.name} />
                  {selectedSavedFaceId === face.id && status === "idle" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Check className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  )}
                  {status === "sending" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
                    </div>
                  )}
                  {status === "sent" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/60">
                      <Check className="h-6 w-6 text-emerald-300 drop-shadow" />
                    </div>
                  )}
                  {status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
                      <AlertCircle className="h-6 w-6 text-red-300 drop-shadow" />
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <span className="max-w-[64px] truncate text-[10px] text-zinc-400">{face.name}</span>
                  <button
                    onClick={() => deleteFace(face.id)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
                {face.category && (
                  <span className="text-[9px] text-zinc-600">{face.category}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
