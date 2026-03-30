/**
 * scannerUtils.ts
 * Advanced utilities for document scanning, perspective correction, and image optimization.
 */

export interface ScanOptions {
  grayscale?: boolean;
  enhanceContrast?: boolean;
  maxSizeBytes?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: ScanOptions = {
  grayscale: true,
  enhanceContrast: true,
  maxSizeBytes: 700 * 1024, // 700KB
  quality: 0.8
};

/**
 * Processes an image to look like a scanned document and optimizes its size.
 * Includes optional perspective deskewing.
 */
export async function processDocumentImage(
  imageDataUrl: string,
  options: ScanOptions = {},
  points?: { x: number, y: number }[] // 4 points for perspective crop
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let originalImg = await loadImage(imageDataUrl);
  
  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  if (points && points.length === 4) {
    // Perform perspective deskewing
    canvas = deskewImage(originalImg, points);
    ctx = canvas.getContext('2d')!;
  } else {
    canvas.width = originalImg.width;
    canvas.height = originalImg.height;
    ctx.drawImage(originalImg, 0, 0);
  }

  // 1. Greyscale and Contrast
  applyScanFilters(ctx, canvas.width, canvas.height, opts);

  // 2. Progressive compression to meet size limit
  return await compressToLimit(canvas, opts.maxSizeBytes!);
}

/**
 * Performs perspective transformation to flatten/deskew the document
 */
function deskewImage(img: HTMLImageElement, points: { x: number, y: number }[]): HTMLCanvasElement {
  const sorted = sortPoints(points);
  
  const widthA = Math.hypot(sorted[2].x - sorted[3].x, sorted[2].y - sorted[3].y);
  const widthB = Math.hypot(sorted[1].x - sorted[0].x, sorted[1].y - sorted[0].y);
  const maxWidth = Math.max(widthA, widthB);

  const heightA = Math.hypot(sorted[1].x - sorted[2].x, sorted[1].y - sorted[2].y);
  const heightB = Math.hypot(sorted[0].x - sorted[3].x, sorted[0].y - sorted[3].y);
  const maxHeight = Math.max(heightA, heightB);

  const destCanvas = document.createElement('canvas');
  destCanvas.width = maxWidth;
  destCanvas.height = maxHeight;
  const dCtx = destCanvas.getContext('2d')!;

  // Map Dst corners to Src corners for Inverse Mapping
  const dstCoords = [
    { x: 0, y: 0 },
    { x: maxWidth, y: 0 },
    { x: maxWidth, y: maxHeight },
    { x: 0, y: maxHeight }
  ];
  
  const h = getPerspectiveTransform(dstCoords, sorted);

  // Apply warping
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const sCtx = srcCanvas.getContext('2d')!;
  sCtx.drawImage(img, 0, 0);
  const srcData = sCtx.getImageData(0, 0, img.width, img.height);
  
  const dstData = dCtx.createImageData(maxWidth, maxHeight);
  
  for (let y = 0; y < maxHeight; y++) {
    for (let x = 0; x < maxWidth; x++) {
      const w = h[6] * x + h[7] * y + h[8];
      const u = (h[0] * x + h[1] * y + h[2]) / w;
      const v = (h[3] * x + h[4] * y + h[5]) / w;

      if (u >= 0 && u < img.width && v >= 0 && v < img.height) {
        const sx = Math.floor(u);
        const sy = Math.floor(v);
        const si = (sy * img.width + sx) * 4;
        const di = (y * Math.floor(maxWidth) + x) * 4;
        
        dstData.data[di] = srcData.data[si];
        dstData.data[di + 1] = srcData.data[si + 1];
        dstData.data[di + 2] = srcData.data[si + 2];
        dstData.data[di + 3] = srcData.data[si + 3];
      }
    }
  }
  
  dCtx.putImageData(dstData, 0, 0);
  return destCanvas;
}

function sortPoints(pts: { x: number, y: number }[]) {
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]]; // TL, TR, BR, BL
}

function getPerspectiveTransform(src: {x:number, y:number}[], dst: {x:number, y:number}[]) {
  const system = [];
  for (let i = 0; i < 4; i++) {
    system.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x, dst[i].x]);
    system.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y, dst[i].y]);
  }
  const result = solveGaussian(system);
  return [...result, 1];
}

function solveGaussian(A: number[][]) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j;
    [A[i], A[max]] = [A[max], A[i]];
    if (Math.abs(A[i][i]) < 1e-10) return new Array(n).fill(0);
    for (let j = i + 1; j < n; j++) {
      const c = A[j][i] / A[i][i];
      for (let k = i; k < n + 1; k++) A[j][k] -= c * A[i][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = 0;
    for (let j = i + 1; j < n; j++) s += A[i][j] * x[j];
    x[i] = (A[i][n] - s) / A[i][i];
  }
  return x;
}

/**
 * Automatically detects document corners by searching for high-contrast edges from the image boundaries.
 * Best for dark/cluttered backgrounds.
 */
export async function autoDetectDocument(imageDataUrl: string): Promise<{x: number, y: number}[]> {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  const size = 300; // Small size for fast detection
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  // Grayscale and Blur (simple box blur)
  const gray = new Uint8Array(size * size);
  for (let i = 0; i < data.length; i += 4) {
    gray[i/4] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
  }

  // Edge detection simplified: find first pixel from each corner that differs significantly from average/corner color
  const threshold = 40;
  
  const findEdge = (startX: number, startY: number, stepX: number, stepY: number) => {
    let x = startX, y = startY;
    const baseColor = gray[y * size + x];
    
    // Move diagonally and orthogonally to find the "first major change"
    for (let i = 0; i < size / 2; i++) {
      const cx = Math.floor(startX + i * stepX);
      const cy = Math.floor(startY + i * stepY);
      if (cx < 0 || cx >= size || cy < 0 || cy >= size) break;
      
      const val = gray[cy * size + cx];
      if (Math.abs(val - baseColor) > threshold) {
        return { x: (cx / size) * 100, y: (cy / size) * 100 };
      }
    }
    return { x: (startX / size) * 100, y: (startY / size) * 100 };
  };

  return [
    findEdge(10, 10, 1, 1),      // Top Left
    findEdge(size-10, 10, -1, 1), // Top Right
    findEdge(size-10, size-10, -1, -1), // Bottom Right
    findEdge(10, size-10, 1, -1)  // Bottom Left
  ];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function applyScanFilters(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: ScanOptions
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (opts.grayscale) {
      const avg = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = avg;
    }
    if (opts.enhanceContrast) {
      const factor = 1.6;
      r = Math.min(255, Math.max(0, 128 + (r - 128) * factor));
      g = Math.min(255, Math.max(0, 128 + (g - 128) * factor));
      b = Math.min(255, Math.max(0, 128 + (b - 128) * factor));
    }
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function compressToLimit(canvas: HTMLCanvasElement, limit: number): Promise<File> {
  let quality = 0.8;
  let blob: Blob | null = null;
  const MAX_DIMENSION = 1800;
  if (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(canvas.width, canvas.height);
    const scaled = document.createElement('canvas');
    scaled.width = canvas.width * scale;
    scaled.height = canvas.height * scale;
    scaled.getContext('2d')?.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    canvas = scaled;
  }
  do {
    blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) break;
    if (blob.size < limit) break;
    quality -= 0.1;
  } while (quality > 0.1);
  if (!blob) throw new Error('Compression failed');
  return new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
}
