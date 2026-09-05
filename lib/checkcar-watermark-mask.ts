/**
 * CheckCar.vin ūdenszīmes noteikšana un aizklāšana (tīrs RGB, bez sharp).
 * Meklē sarkano „VIN” + pelēko „CHECKCAR”, tad uzliek pelēku mozaīkas joslu.
 */

export type RgbBuffer = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: 3 | 4;
};

export type CheckcarWatermarkBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CheckcarWatermarkHit = {
  box: CheckcarWatermarkBox;
  vinLetters: number;
  grayLetters: number;
};

type LetterBlob = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  area: number;
};

function pixelOffset(img: RgbBuffer, x: number, y: number): number {
  return (y * img.width + x) * img.channels;
}

function readRgb(img: RgbBuffer, x: number, y: number): [number, number, number] {
  const i = pixelOffset(img, x, y);
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
}

function writeRgb(img: RgbBuffer, x: number, y: number, r: number, g: number, b: number): void {
  const i = pixelOffset(img, x, y);
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
}

/** Sarkans CheckCar „VIN” slānis (pustcaurspīdīgs, ne oranžs). */
export function isCheckcarVinRed(r: number, g: number, b: number): boolean {
  if (r < 78) return false;
  if (r < g + 30 || r < b + 16) return false;
  const min = g < b ? g : b;
  if ((r - min) / r < 0.38) return false;
  if (g > b + 42) return false;
  return true;
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pelēks CheckCar „CHECKCAR” slānis. Nav košs UI baltais un nav gandrīz melns fons. */
export function isCheckcarGray(r: number, g: number, b: number): boolean {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  if (max < 76 || max > 214) return false;
  if (max - min > 30) return false;
  if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20) return false;
  return true;
}

function blobWidth(b: LetterBlob): number {
  return b.maxX - b.minX + 1;
}

function blobHeight(b: LetterBlob): number {
  return b.maxY - b.minY + 1;
}

function collectBlobs(
  img: RgbBuffer,
  match: (r: number, g: number, b: number) => boolean,
): LetterBlob[] {
  const { width, height } = img;
  const seen = new Uint8Array(width * height);
  const blobs: LetterBlob[] = [];
  const stackX: number[] = [];
  const stackY: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (seen[idx]) continue;
      const [r, g, b] = readRgb(img, x, y);
      if (!match(r, g, b)) {
        seen[idx] = 1;
        continue;
      }

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      stackX.push(x);
      stackY.push(y);
      seen[idx] = 1;

      while (stackX.length) {
        const cx = stackX.pop()!;
        const cy = stackY.pop()!;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (seen[nIdx]) continue;
            const [nr, ng, nb] = readRgb(img, nx, ny);
            if (!match(nr, ng, nb)) {
              seen[nIdx] = 1;
              continue;
            }
            seen[nIdx] = 1;
            stackX.push(nx);
            stackY.push(ny);
          }
        }
      }

      blobs.push({ minX, maxX, minY, maxY, area });
    }
  }

  return blobs;
}

function isLetterSized(blob: LetterBlob, width: number, height: number): boolean {
  const w = blobWidth(blob);
  const h = blobHeight(blob);
  if (h < Math.max(8, height * 0.016) || h > height * 0.18) return false;
  if (w < Math.max(4, width * 0.004) || w > width * 0.12) return false;
  if (blob.area < w * h * 0.12) return false;
  const aspect = w / h;
  if (aspect > 2.4 || aspect < 0.08) return false;
  return true;
}

function yOverlapRatio(a: LetterBlob, b: LetterBlob): number {
  const top = Math.max(a.minY, b.minY);
  const bot = Math.min(a.maxY, b.maxY);
  const overlap = bot - top + 1;
  if (overlap <= 0) return 0;
  return overlap / Math.min(blobHeight(a), blobHeight(b));
}

function findVinCluster(letters: LetterBlob[], imgW: number): LetterBlob[] | null {
  if (letters.length < 2) return null;
  const sorted = [...letters].sort((a, b) => a.minX - b.minX);
  const medianH =
    [...sorted].sort((a, b) => blobHeight(a) - blobHeight(b))[Math.floor(sorted.length / 2)] ??
    sorted[0]!;
  const refH = blobHeight(medianH);
  const maxGap = Math.max(10, refH * 0.85);

  for (let i = 0; i < sorted.length; i++) {
    const group = [sorted[i]!];
    for (let j = i + 1; j < sorted.length && group.length < 4; j++) {
      const prev = group[group.length - 1]!;
      const cur = sorted[j]!;
      const gap = cur.minX - prev.maxX;
      if (gap < 0 || gap > maxGap) break;
      const hRatio = blobHeight(cur) / blobHeight(prev);
      if (hRatio < 0.5 || hRatio > 2) break;
      if (yOverlapRatio(prev, cur) < 0.45) break;
      group.push(cur);
    }
    if (group.length < 2) continue;
    const left = group[0]!.minX;
    const right = group[group.length - 1]!.maxX;
    const top = Math.min(...group.map((b) => b.minY));
    const bot = Math.max(...group.map((b) => b.maxY));
    const spanW = right - left + 1;
    const spanH = bot - top + 1;
    const ratio = spanW / spanH;
    if (ratio < 1.6 || ratio > 5.8) continue;
    if (spanW < imgW * 0.045 || spanW > imgW * 0.28) continue;
    if (group.length === 2 && ratio < 2.0) continue;
    return group;
  }
  return null;
}

function grayLettersLeftOfVin(
  grayLetters: LetterBlob[],
  vin: LetterBlob[],
): LetterBlob[] {
  const vinLeft = Math.min(...vin.map((b) => b.minX));
  const vinTop = Math.min(...vin.map((b) => b.minY));
  const vinBot = Math.max(...vin.map((b) => b.maxY));
  const vinH = vinBot - vinTop + 1;
  const vinW = Math.max(...vin.map((b) => b.maxX)) - vinLeft + 1;
  const searchLeft = Math.max(0, vinLeft - Math.round(vinW * 4.2));
  const yPad = Math.round(vinH * 0.45);

  return grayLetters.filter((b) => {
    if (b.maxX > vinLeft - 2) return false;
    if (b.minX < searchLeft) return false;
    if (b.maxY < vinTop - yPad || b.minY > vinBot + yPad) return false;
    const hRatio = blobHeight(b) / vinH;
    return hRatio >= 0.45 && hRatio <= 1.7;
  });
}

export function detectCheckcarVinWatermark(img: RgbBuffer): CheckcarWatermarkHit | null {
  if (img.width < 80 || img.height < 60) return null;

  const redBlobs = collectBlobs(img, isCheckcarVinRed).filter((b) =>
    isLetterSized(b, img.width, img.height),
  );
  const vin = findVinCluster(redBlobs, img.width);
  if (!vin) return null;

  const grayBlobs = collectBlobs(img, isCheckcarGray).filter((b) =>
    isLetterSized(b, img.width, img.height),
  );
  const grayLeft = grayLettersLeftOfVin(grayBlobs, vin);

  const vinLeft = Math.min(...vin.map((b) => b.minX));
  const vinRight = Math.max(...vin.map((b) => b.maxX));
  const vinTop = Math.min(...vin.map((b) => b.minY));
  const vinBot = Math.max(...vin.map((b) => b.maxY));
  const vinW = vinRight - vinLeft + 1;
  const vinH = vinBot - vinTop + 1;

  const strongVin = vin.length >= 3 && vinW / vinH >= 1.9 && vinW / vinH <= 3.6;
  if (grayLeft.length < 4 && !strongVin) return null;
  if (grayLeft.length < 3 && vin.length < 3) return null;

  const letters = grayLeft.length >= 3 ? [...grayLeft, ...vin] : vin;
  const padX = Math.max(10, Math.round(vinH * 0.55));
  const padY = Math.max(8, Math.round(vinH * 0.5));
  let x0 = Math.min(...letters.map((b) => b.minX)) - padX;
  const x1 = Math.max(...letters.map((b) => b.maxX)) + padX;
  const y0 = Math.min(...letters.map((b) => b.minY)) - padY;
  const y1 = Math.max(...letters.map((b) => b.maxY)) + padY;

  if (grayLeft.length < 3 && strongVin) {
    x0 = Math.min(x0, vinLeft - Math.round(vinW * 3.05) - padX);
  }

  const box: CheckcarWatermarkBox = {
    x: Math.max(0, x0),
    y: Math.max(0, y0),
    w: Math.min(img.width - 1, x1) - Math.max(0, x0) + 1,
    h: Math.min(img.height - 1, y1) - Math.max(0, y0) + 1,
  };
  if (box.w < 20 || box.h < 8) return null;

  return { box, vinLetters: vin.length, grayLetters: grayLeft.length };
}

/** Pelēka cenzūras mozaīka pār visu ūdenszīmes joslu. */
export function applyGrayMosaicBar(img: RgbBuffer, box: CheckcarWatermarkBox): void {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(img.width, box.x + box.w);
  const y1 = Math.min(img.height, box.y + box.h);
  if (x1 <= x0 || y1 <= y0) return;

  const tile = Math.max(14, Math.round(box.h / 2.15));

  for (let ty = y0; ty < y1; ty += tile) {
    for (let tx = x0; tx < x1; tx += tile) {
      const bx = Math.min(x1, tx + tile);
      const by = Math.min(y1, ty + tile);
      let sum = 0;
      let n = 0;
      for (let y = ty; y < by; y++) {
        for (let x = tx; x < bx; x++) {
          const [r, g, b] = readRgb(img, x, y);
          sum += luma(r, g, b);
          n++;
        }
      }
      const avg = n > 0 ? sum / n : 90;
      const gray = Math.max(78, Math.min(112, Math.round(avg * 0.08 + 90)));
      for (let y = ty; y < by; y++) {
        for (let x = tx; x < bx; x++) {
          writeRgb(img, x, y, gray, gray, gray);
        }
      }
    }
  }
}

export function coverCheckcarVinWatermarkRgb(img: RgbBuffer): CheckcarWatermarkHit | null {
  const hit = detectCheckcarVinWatermark(img);
  if (!hit) return null;
  applyGrayMosaicBar(img, hit.box);
  return hit;
}
