import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, X, ZoomIn, Sliders, RotateCw, Save, Download } from "lucide-react";
import type { BLEManagerApi } from "../hooks/useBLEManager";
import { useFaceStorage } from "../hooks/useFaceStorage";
import { getCroppedCircleDataUrl, convertToRGB565 } from "../utils/cropImage";
import { TransferProgressBar } from "./TransferProgress";
import { RGB565_IMAGE_BYTES } from "../types";

export function CustomFaceUploader({ ble, onClose }: { ble: BLEManagerApi; onClose: () => void }) {
  const { saveFace } = useFaceStorage();
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("Custom Face");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { transfer, uploadCustomFace, cancelTransfer, connectionState } = ble;
  const busy = transfer.phase !== "idle" && transfer.phase !== "complete" && transfer.phase !== "error" && transfer.phase !== "cancelled";

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setPreview(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setRotation(0);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const confirmCrop = async () => {
    if (!rawImage || !croppedAreaPixels) return;
    const dataUrl = await getCroppedCircleDataUrl(rawImage, croppedAreaPixels, 480, brightness, contrast, saturation, rotation);
    setPreview(dataUrl);
  };

  const doUpload = () => {
    if (!preview) return;
    uploadCustomFace(name || "Custom Face", preview);
  };

  const doSave = () => {
    if (!preview) return;
    saveFace(name || "Custom Face", preview);
  };

  const exportAsPNG = () => {
    if (!preview) return;
    const url = preview;
    const link = document.createElement("a");
    link.download = `${name || "face"}.png`;
    link.href = url;
    link.click();
  };

  const exportAsRGB565 = async () => {
    if (!preview) return;
    const buffer = await convertToRGB565(preview, 480);
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${name || "face"}.rgb565`;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">New design</h2>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-zinc-800">
          <X className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {!rawImage && (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-800 text-zinc-500 hover:border-zinc-700"
          >
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm">Choose a photo</span>
            <span className="text-[11px] text-zinc-600">JPEG/PNG · cropped to fit the badge</span>
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPick} />

        {rawImage && !preview && (
          <div className="space-y-4">
            <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-black">
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                rotation={rotation}
              />
            </div>
            <div className="flex items-center gap-3">
              <ZoomIn className="h-4 w-4 text-zinc-400" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              <Sliders className="h-3.5 w-3.5" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>

            {showFilters && (
              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Brightness</span>
                    <span>{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Contrast</span>
                    <span>{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Saturation</span>
                    <span>{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Rotation</span>
                  <button
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    <RotateCw className="h-3 w-3" />
                    {rotation}°
                  </button>
                </div>
                <button
                  onClick={() => {
                    setBrightness(100);
                    setContrast(100);
                    setSaturation(100);
                    setRotation(0);
                  }}
                  className="w-full rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Reset Filters
                </button>
              </div>
            )}

            <button
              onClick={confirmCrop}
              className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Confirm Crop
            </button>
            <button onClick={() => setRawImage(null)} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300">
              Choose another photo
            </button>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="h-40 w-40 overflow-hidden rounded-full ring-2 ring-blue-500/60">
                <img src={preview} className="h-full w-full object-cover" alt="Cropped preview" />
              </div>
              <p className="text-[11px] text-zinc-500">
                Ready for upload · {(RGB565_IMAGE_BYTES / 1024).toFixed(0)}KB
              </p>
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Face name"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />

            <div className="flex gap-2">
              <button
                onClick={exportAsPNG}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                <Download className="inline h-3 w-3 mr-1" /> Export PNG
              </button>
              <button
                onClick={exportAsRGB565}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                <Download className="inline h-3 w-3 mr-1" /> Export file
              </button>
            </div>

            {connectionState !== "ready" && (
              <p className="rounded-lg bg-amber-950/60 px-3 py-2 text-[11px] text-amber-300">
                Not connected — connect to the badge before uploading.
              </p>
            )}

            <TransferProgressBar transfer={transfer} onCancel={cancelTransfer} />

            {transfer.phase === "complete" ? (
              <div className="flex gap-2">
                <button
                  onClick={doSave}
                  className="flex-1 rounded-full border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-950/30"
                >
                  <Save className="inline h-3.5 w-3.5 mr-1" /> Save design
                </button>
                <button onClick={onClose} className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
                  Done
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(null)}
                  disabled={busy}
                  className="flex-1 rounded-full border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={doUpload}
                  disabled={busy || connectionState !== "ready"}
                  className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy ? "Uploading…" : "Send now"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
