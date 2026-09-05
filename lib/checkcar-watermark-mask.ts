/**
 * CheckCar.vin ūdenszīmes noteikšana un aizklāšana (tīrs RGB, bez sharp).
 * Meklē pelēko „CHECKCAR” + sarkano „VIN” (arī virs aizmugures lukturiem), tad raibu mozaīku.
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

/** CheckCar.vin eksportos uzrakstu parasti liek kadra vidū. */
export function fixedCheckcarWatermarkBox(width: number, height: number): CheckcarWatermarkBox {
  return bandBox(width, height, 0.43);
}

function bandBox(width: number, height: number, yFrac: number): CheckcarWatermarkBox {
  const w = Math.max(48, Math.round(width * 0.72));
  const h = Math.max(18, Math.round(height * 0.16));
  const y = Math.max(0, Math.round(height * yFrac));
  return {
    x: Math.max(0, Math.round((width - w) / 2)),
    y,
    w: Math.min(width, w),
    h: Math.min(height - y, h),
  };
}

function clampBox(img: RgbBuffer, box: CheckcarWatermarkBox): CheckcarWatermarkBox {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const x1 = Math.min(img.width, box.x + box.w);
  const y1 = Math.min(img.height, box.y + box.h);
  return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
}

type BandScore = {
  grayThenRedRows: number;
  vinRed: number;
  vinN: number;
  gray: number;
  n: number;
  red: number;
};

function scoreBand(img: RgbBuffer, box: CheckcarWatermarkBox): BandScore {
  const x0 = box.x;
  const y0 = box.y;
  const x1 = box.x + box.w;
  const y1 = box.y + box.h;
  const vinX = x0 + Math.round(box.w * 0.58);
  const stepX = Math.max(1, Math.round(box.w / 90));
  const stepY = Math.max(1, Math.round(box.h / 14));
  const minGrayRun = Math.max(4, Math.round(img.width * 0.07 / stepX));
  const minRedRun = Math.max(3, Math.round(img.width * 0.028 / stepX));
  const maxRedRun = Math.max(minRedRun + 1, Math.round(img.width * 0.26 / stepX));

  let vinRed = 0;
  let vinN = 0;
  let gray = 0;
  let red = 0;
  let n = 0;
  let grayThenRedRows = 0;

  for (let y = y0; y < y1; y += stepY) {
    let grayRun = 0;
    let sawGray = false;
    let gap = 0;
    let redRun = 0;
    let rowHit = false;
    for (let x = x0; x < x1; x += stepX) {
      const [r, g, b] = readRgb(img, x, y);
      const isRed = isCheckcarVinRed(r, g, b);
      const isGray = isCheckcarGray(r, g, b);
      n++;
      if (isRed) red++;
      if (isGray) gray++;
      if (x >= vinX) {
        vinN++;
        if (isRed) vinRed++;
      }

      if (isGray && !isRed) {
        if (sawGray && redRun >= minRedRun && redRun <= maxRedRun) rowHit = true;
        grayRun++;
        gap = 0;
        redRun = 0;
        if (grayRun >= minGrayRun) sawGray = true;
      } else if (isRed) {
        if (sawGray && gap <= 3) redRun++;
        else redRun = 0;
        grayRun = 0;
        gap = 0;
      } else {
        if (sawGray && redRun >= minRedRun && redRun <= maxRedRun) rowHit = true;
        grayRun = 0;
        redRun = 0;
        if (sawGray) gap++;
        if (gap > 3) sawGray = false;
      }
    }
    if (sawGray && redRun >= minRedRun && redRun <= maxRedRun) rowHit = true;
    if (rowHit) grayThenRedRows++;
  }

  return { grayThenRedRows, vinRed, vinN, gray, n, red };
}

function bandIsSolidRedBar(s: BandScore): boolean {
  if (s.n < 20) return true;
  return s.red / s.n > 0.38 && s.gray / s.n < 0.07;
}

function bandHasMark(s: BandScore): boolean {
  if (bandIsSolidRedBar(s)) return false;
  if (s.grayThenRedRows >= 1) return true;
  const vinRatio = s.vinN > 0 ? s.vinRed / s.vinN : 0;
  const grayRatio = s.n > 0 ? s.gray / s.n : 0;
  if (grayRatio > 0.55 || grayRatio < 0.08) return false;
  return (s.vinRed >= 8 || vinRatio >= 0.02) && s.red / s.n < 0.35;
}

function mosaicTileTone(tx: number, ty: number): number {
  const n = ((tx * 374761393 + ty * 668265263) >>> 0) % 256;
  if (n < 48) return 18 + (n % 28);
  if (n < 110) return 72 + (n % 52);
  if (n < 188) return 132 + (n % 48);
  return 196 + (n % 48);
}

/** Lieli, raibi kubi visā ūdenszīmes joslā. */
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

const SCAN_Y = [0.2, 0.28, 0.36, 0.43, 0.5, 0.57, 0.64, 0.72];

export function detectCheckcarVinWatermark(img: RgbBuffer): CheckcarWatermarkHit | null {
  if (img.width < 80 || img.height < 60) return null;

  const hits: { box: CheckcarWatermarkBox; score: BandScore }[] = [];

  for (const yFrac of SCAN_Y) {
    const box = clampBox(img, bandBox(img.width, img.height, yFrac));
    if (box.w < 24 || box.h < 10) continue;
    const score = scoreBand(img, box);
    if (!bandHasMark(score)) continue;
    hits.push({ box, score });
  }

  if (hits.length === 0) return null;

  let x0 = hits[0]!.box.x;
  let y0 = hits[0]!.box.y;
  let x1 = hits[0]!.box.x + hits[0]!.box.w;
  let y1 = hits[0]!.box.y + hits[0]!.box.h;
  let vinRed = 0;
  let gray = 0;
  for (const hit of hits) {
    x0 = Math.min(x0, hit.box.x);
    y0 = Math.min(y0, hit.box.y);
    x1 = Math.max(x1, hit.box.x + hit.box.w);
    y1 = Math.max(y1, hit.box.y + hit.box.h);
    vinRed += hit.score.vinRed;
    gray += hit.score.gray;
  }

  return {
    box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    vinLetters: vinRed > 0 ? 1 : 0,
    grayLetters: gray > 0 ? 1 : 0,
  };
}

export function coverCheckcarVinWatermarkRgb(img: RgbBuffer): CheckcarWatermarkHit | null {
  const hit = detectCheckcarVinWatermark(img);
  if (!hit) return null;
  applyGrayMosaicBar(img, hit.box);
  return hit;
}
