/**
 * CheckCar.vin ūdenszīmes aizklāšana (tīrs RGB, bez sharp).
 * Uzraksts eksportos vienmēr ir kadra vidū: fiksēta josla + raiba mozaīka.
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

/** Sarkans CheckCar „VIN” slānis, arī pustcaurspīdīgs uz gaiša fona. */
export function isCheckcarVinRed(r: number, g: number, b: number): boolean {
  if (r < 58) return false;
  if (r < g + 12 || r < b + 8) return false;
  const min = g < b ? g : b;
  if ((r - min) / r < 0.14) return false;
  if (g > b + 48) return false;
  return true;
}

/** Pelēks / balts CheckCar „CHECKCAR” slānis, arī uz gaiša auto. */
export function isCheckcarGray(r: number, g: number, b: number): boolean {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  if (max < 70 || max > 236) return false;
  if (max - min > 36) return false;
  if (Math.abs(r - g) > 22 || Math.abs(g - b) > 22) return false;
  return true;
}

/** CheckCar.vin eksportos uzrakstu liek kadra vidū. */
export function fixedCheckcarWatermarkBox(width: number, height: number): CheckcarWatermarkBox {
  const w = Math.max(48, Math.round(width * 0.68));
  const h = Math.max(18, Math.round(height * 0.145));
  return {
    x: Math.max(0, Math.round((width - w) / 2)),
    y: Math.max(0, Math.round(height * 0.43)),
    w: Math.min(width, w),
    h: Math.min(height - Math.round(height * 0.43), h),
  };
}

function clampBox(img: RgbBuffer, box: CheckcarWatermarkBox): CheckcarWatermarkBox {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const x1 = Math.min(img.width, box.x + box.w);
  const y1 = Math.min(img.height, box.y + box.h);
  return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
}

/** Cheap gate: VIN slot in the known band is red, left side is not a red bar. */
function centerHasCheckcarMark(img: RgbBuffer, box: CheckcarWatermarkBox): boolean {
  const x0 = box.x;
  const y0 = box.y;
  const x1 = box.x + box.w;
  const y1 = box.y + box.h;
  const vinX = x0 + Math.round(box.w * 0.68);
  const step = Math.max(1, Math.round(Math.min(box.w, box.h) / 28));
  let vinRed = 0;
  let vinN = 0;
  let leftRed = 0;
  let leftN = 0;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const [r, g, b] = readRgb(img, x, y);
      const red = isCheckcarVinRed(r, g, b);
      if (x >= vinX) {
        vinN++;
        if (red) vinRed++;
      } else {
        leftN++;
        if (red) leftRed++;
      }
    }
  }

  if (leftN > 8 && leftRed / leftN > 0.22) return false;
  if (vinN < 6) return false;
  return vinRed >= 8 || vinRed / vinN >= 0.012;
}

function mosaicTileTone(tx: number, ty: number): number {
  const n = ((tx * 374761393 + ty * 668265263) >>> 0) % 256;
  if (n < 48) return 18 + (n % 28);
  if (n < 110) return 72 + (n % 52);
  if (n < 188) return 132 + (n % 48);
  return 196 + (n % 48);
}

/** Lieli, raibi kubi visā fiksētajā joslā. */
export function applyGrayMosaicBar(img: RgbBuffer, box: CheckcarWatermarkBox): void {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(img.width, box.x + box.w);
  const y1 = Math.min(img.height, box.y + box.h);
  if (x1 <= x0 || y1 <= y0) return;

  const tile = Math.max(18, Math.round((y1 - y0) / 2.05));

  for (let ty = y0; ty < y1; ty += tile) {
    for (let tx = x0; tx < x1; tx += tile) {
      const bx = Math.min(x1, tx + tile);
      const by = Math.min(y1, ty + tile);
      const gray = mosaicTileTone(tx, ty);
      for (let y = ty; y < by; y++) {
        for (let x = tx; x < bx; x++) {
          writeRgb(img, x, y, gray, gray, gray);
        }
      }
    }
  }
}

export function detectCheckcarVinWatermark(img: RgbBuffer): CheckcarWatermarkHit | null {
  if (img.width < 80 || img.height < 60) return null;
  const box = clampBox(img, fixedCheckcarWatermarkBox(img.width, img.height));
  if (box.w < 24 || box.h < 10) return null;
  if (!centerHasCheckcarMark(img, box)) return null;
  return { box, vinLetters: 1, grayLetters: 1 };
}

export function coverCheckcarVinWatermarkRgb(img: RgbBuffer): CheckcarWatermarkHit | null {
  const hit = detectCheckcarVinWatermark(img);
  if (!hit) return null;
  applyGrayMosaicBar(img, hit.box);
  return hit;
}
