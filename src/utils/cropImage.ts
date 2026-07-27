// Mirrors the native CGContext-based crop/resize used by UIImage+RGB565 —
// here we rasterize the crop to a fixed 480x480 canvas before "converting".
export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function getCroppedCircleDataUrl(
  imageSrc: string,
  cropAreaPixels: PixelArea,
  outputSize = 480,
  brightness = 100,
  contrast = 100,
  saturation = 100,
  rotation = 0
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  ctx.save();

  // Apply rotation first
  if (rotation !== 0) {
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-outputSize / 2, -outputSize / 2);
  }

  // Apply filters
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  // Then clip to circle
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    outputSize,
    outputSize
  );
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// Real RGB565 buffer size: 2 bytes per pixel
export function rgb565SizeFor(width: number, height: number) {
  return width * height * 2;
}

/**
 * Convert a cropped face dataUrl to a real RGB565 binary buffer.
 * Mirrors the native UIImage+RGB565.swift packing: for each pixel,
 * R is packed into bits [15:11], G into [10:5], B into [4:0] (big-endian).
 */
export async function convertToRGB565(dataUrl: string, size = 480): Promise<ArrayBuffer> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data; // RGBA, 4 bytes per pixel
  const buffer = new ArrayBuffer(size * size * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < size * size; i++) {
    const r = pixels[i * 4] >> 3;       // 5 bits
    const g = pixels[i * 4 + 1] >> 2;   // 6 bits
    const b = pixels[i * 4 + 2] >> 3;   // 5 bits
    const rgb565 = (r << 11) | (g << 5) | b;
    view.setUint16(i * 2, rgb565, false); // big-endian to match ESP32 expectations
  }

  return buffer;
}
