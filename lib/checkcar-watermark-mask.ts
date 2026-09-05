/**
 * CheckCar.vin ūdenszīmes aizklāšana (tīrs RGB, bez sharp).
 * Vienmēr tā pati centra josla visām bildēm. Nemeklē burtus.
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
  if (r < 52) return false;
  if (r < g + 8 || r < b + 6) return false;
  const min = g < b ? g : b;
  if ((r - min) / r < 0.1) return false;
  if (g > b + 52) return false;
  return true;
}

/** Pelēks / balts CheckCar „CHECKCAR” slānis, arī uz gaiša auto. */
export function isCheckcarGray(r: number, g: number, b: number): boolean {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  if (max < 70 || max > 242) return false;
  if (max - min > 40) return false;
  if (Math.abs(r - g) > 24 || Math.abs(g - b) > 24) return false;
  return true;
}

/** Viena un tā pati josla: 66% plats, 12% augsts, tieši kadra vidū. */
export function fixedCheckcarWatermarkBox(width: number, height: number): CheckcarWatermarkBox {
  const w = Math.max(48, Math.round(width * 0.66));
  const h = Math.max(16, Math.round(height * 0.12));
  return {
    x: Math.max(0, Math.round((width - w) / 2)),
    y: Math.max(0, Math.round((height - h) / 2)),
    w: Math.min(width, w),
    h: Math.min(height, h),
  };
}

function mosaicTileTone(tx: number, ty: number): number {
  const n = ((tx * 374761393 + ty * 668265263) >>> 0) % 256;
  if (n < 48) return 18 + (n % 28);
  if (n < 110) return 72 + (n % 52);
  if (n < 188) return 132 + (n % 48);
  return 196 + (n % 48);
}

function mosaicTileSize(boxH: number): number {
  return Math.max(10, Math.min(18, Math.round(boxH / 2.2)));
}

/** Raiba mozaīka fiksētajā joslā. */
export function applyGrayMosaicBar(img: RgbBuffer, box: CheckcarWatermarkBox): void {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(img.width, box.x + box.w);
  const y1 = Math.min(img.height, box.y + box.h);
  if (x1 <= x0 || y1 <= y0) return;

  const tile = mosaicTileSize(y1 - y0);

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

/** Jau uzlikta mozaīka: nav sarkanā VIN un kubi ir pelēki ar lielu luma atšķirību. */
function centerAlreadyMosaiced(img: RgbBuffer, box: CheckcarWatermarkBox): boolean {
  const tile = mosaicTileSize(box.h);
  const vinX = box.x + Math.round(box.w * 0.58);
  let vinRed = 0;
  let cells = 0;
  let flat = 0;
  let minL = 255;
  let maxL = 0;
  for (let ty = box.y; ty + 2 < box.y + box.h; ty += tile) {
    for (let tx = box.x; tx + 2 < box.x + box.w; tx += tile) {
      let s = 0;
      let n = 0;
      let chroma = 0;
      const by = Math.min(img.height, ty + tile);
      const bx = Math.min(img.width, tx + tile);
      for (let y = ty; y < by; y += 2) {
        for (let x = tx; x < bx; x += 2) {
          const [r, g, b] = readRgb(img, x, y);
          if (x >= vinX && isCheckcarVinRed(r, g, b)) vinRed++;
          const max = r > g ? (r > b ? r : b) : g > b ? g : b;
          const min = r < g ? (r < b ? r : b) : g < b ? g : b;
          chroma += max - min;
          s += (r + g + b) / 3;
          n++;
        }
      }
      if (n === 0) continue;
      cells++;
      const luma = s / n;
      if (chroma / n < 22) {
        flat++;
        if (luma < minL) minL = luma;
        if (luma > maxL) maxL = luma;
      }
    }
  }
  if (vinRed >= 3) return false;
  return cells >= 6 && flat / cells >= 0.85 && minL < 80 && maxL > 160 && maxL - minL > 70;
}

export function detectCheckcarVinWatermark(img: RgbBuffer): CheckcarWatermarkHit | null {
  if (img.width < 80 || img.height < 60) return null;
  const box = fixedCheckcarWatermarkBox(img.width, img.height);
  if (centerAlreadyMosaiced(img, box)) return null;
  return { box, vinLetters: 1, grayLetters: 1 };
}

export function coverCheckcarVinWatermarkRgb(img: RgbBuffer): CheckcarWatermarkHit | null {
  const hit = detectCheckcarVinWatermark(img);
  if (!hit) return null;
  applyGrayMosaicBar(img, hit.box);
  return hit;
}
