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
  const h = Math.max(14, Math.round(height * 0.09));
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

function capStripHeight(img: RgbBuffer, box: CheckcarWatermarkBox): CheckcarWatermarkBox {
  const maxH = Math.max(16, Math.round(img.height * 0.13));
  if (box.h <= maxH) return box;
  const mid = box.y + Math.round(box.h / 2);
  return clampBox(img, {
    x: box.x,
    y: mid - Math.ceil(maxH / 2),
    w: box.w,
    h: maxH,
  });
}

type BandScore = {
  grayThenRedRows: number;
  vinRed: number;
  vinN: number;
  gray: number;
  n: number;
  red: number;
};

type MarkSpan = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  rows: number;
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

/** Šaura josla tieši ap CHECKCAR.VIN burtiem, ne visām skenētajām joslām. */
function locateMarkSpan(img: RgbBuffer): MarkSpan | null {
  const stepX = Math.max(1, Math.round(img.width / 140));
  const stepY = Math.max(1, Math.round(img.height / 110));
  const minGrayRun = Math.max(4, Math.round(img.width * 0.07 / stepX));
  const minRedRun = Math.max(3, Math.round(img.width * 0.028 / stepX));
  const maxRedRun = Math.max(minRedRun + 1, Math.round(img.width * 0.24 / stepX));
  const yStart = Math.round(img.height * 0.1);
  const yEnd = Math.round(img.height * 0.9);
  const xStart = Math.round(img.width * 0.06);
  const xEnd = Math.round(img.width * 0.94);

  let minX = img.width;
  let maxX = 0;
  let minY = img.height;
  let maxY = 0;
  let rows = 0;

  for (let y = yStart; y < yEnd; y += stepY) {
    let grayStart = -1;
    let lastGray = -1;
    let graySamples = 0;
    let redStart = -1;
    let lastRed = -1;
    let redSamples = 0;
    let markStart = -1;
    let markEnd = -1;
    /** Plaša tolerance: mērlenta vai cits objekts drīkst uz brīdi aizsegt burtus. */
    const letterGap = Math.max(stepX * 14, Math.round(img.width * 0.1));
    for (let x = xStart; x < xEnd; x += stepX) {
      const [r, g, b] = readRgb(img, x, y);
      const isRed = isCheckcarVinRed(r, g, b);
      const isGray = isCheckcarGray(r, g, b);
      if (isGray && !isRed) {
        if (redSamples >= minRedRun && lastRed - redStart <= maxRedRun * stepX + stepX) {
          markStart = grayStart;
          markEnd = lastRed + stepX;
        }
        if (grayStart < 0 || x - lastGray > letterGap) {
          grayStart = x;
          graySamples = 0;
          redStart = -1;
          lastRed = -1;
          redSamples = 0;
        }
        lastGray = x;
        graySamples++;
      } else if (isRed) {
        const grayWide = grayStart >= 0 && lastGray - grayStart >= minGrayRun * stepX * 0.55 && graySamples >= minGrayRun;
        const nearGray = lastGray >= 0 && x - lastGray <= letterGap;
        if (grayWide && nearGray) {
          if (redStart < 0) redStart = x;
          lastRed = x;
          redSamples++;
        } else {
          redStart = -1;
          lastRed = -1;
          redSamples = 0;
          grayStart = -1;
          lastGray = -1;
          graySamples = 0;
        }
      } else if (lastGray >= 0 && x - lastGray > letterGap && lastRed < 0) {
        grayStart = -1;
        lastGray = -1;
        graySamples = 0;
      }
    }
    if (
      grayStart >= 0 &&
      lastGray - grayStart >= minGrayRun * stepX * 0.55 &&
      graySamples >= minGrayRun &&
      redSamples >= minRedRun &&
      lastRed - redStart <= maxRedRun * stepX + stepX
    ) {
      markStart = grayStart;
      markEnd = lastRed + stepX;
    }
    if (markStart >= 0 && markEnd > markStart) {
      rows++;
      minX = Math.min(minX, markStart);
      maxX = Math.max(maxX, markEnd);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (rows < 1 || maxX <= minX) return null;
  return { x0: minX, x1: maxX, y0: minY, y1: maxY, rows };
}

function boxIsAlreadyMosaic(img: RgbBuffer, box: CheckcarWatermarkBox): boolean {
  const x0 = box.x + Math.round(box.w * 0.62);
  const x1 = box.x + box.w;
  const y0 = box.y;
  const y1 = box.y + box.h;
  const step = Math.max(1, Math.round(Math.min(box.w, box.h) / 16));
  let n = 0;
  let chroma = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const [r, g, b] = readRgb(img, x, y);
      n++;
      const max = r > g ? (r > b ? r : b) : g > b ? g : b;
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      if (max - min > 18) chroma++;
    }
  }
  return n > 8 && chroma / n < 0.08;
}

function spanToBox(img: RgbBuffer, span: MarkSpan): CheckcarWatermarkBox {
  const padX = Math.max(6, Math.round(img.width * 0.016));
  const padY = Math.max(6, Math.round(img.height * 0.038));
  const y = Math.max(0, span.y0 - padY);
  const y1 = Math.min(img.height, span.y1 + padY);
  const h = y1 - y;
  const maxH = Math.max(16, Math.round(img.height * 0.13));
  if (h > maxH) {
    const mid = Math.round((span.y0 + span.y1) / 2);
    return clampBox(img, {
      x: Math.max(0, span.x0 - padX),
      y: Math.max(0, mid - Math.ceil(maxH / 2)),
      w: Math.min(img.width, span.x1 + padX) - Math.max(0, span.x0 - padX),
      h: maxH,
    });
  }
  return clampBox(img, {
    x: Math.max(0, span.x0 - padX),
    y,
    w: Math.min(img.width, span.x1 + padX) - Math.max(0, span.x0 - padX),
    h,
  });
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

  const tile = Math.max(7, Math.min(16, Math.round((y1 - y0) / 3.4)));

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

  const span = locateMarkSpan(img);
  if (span) {
    const box = spanToBox(img, span);
    if (!boxIsAlreadyMosaic(img, box)) {
      return { box: capStripHeight(img, box), vinLetters: 1, grayLetters: 1 };
    }
  }

  let best: { box: CheckcarWatermarkBox; score: BandScore } | null = null;
  let bestRank = -1;
  for (const yFrac of SCAN_Y) {
    const box = clampBox(img, bandBox(img.width, img.height, yFrac));
    if (box.w < 24 || box.h < 10) continue;
    if (boxIsAlreadyMosaic(img, box)) continue;
    const score = scoreBand(img, box);
    if (!bandHasMark(score)) continue;
    const rank = score.grayThenRedRows * 1000 + score.vinRed * 3 + score.gray;
    if (rank > bestRank) {
      bestRank = rank;
      best = { box, score };
    }
  }
  if (!best) return null;
  const padY = Math.max(6, Math.round(img.height * 0.03));
  const insetX = Math.max(8, Math.round(img.width * 0.05));
  const box = clampBox(img, {
    x: best.box.x + insetX,
    y: best.box.y - padY,
    w: best.box.w - insetX * 2,
    h: best.box.h + padY * 2,
  });
  if (boxIsAlreadyMosaic(img, box)) return null;
  return {
    box: capStripHeight(img, box),
    vinLetters: best.score.vinRed > 0 ? 1 : 0,
    grayLetters: best.score.gray > 0 ? 1 : 0,
  };
}

export function coverCheckcarVinWatermarkRgb(img: RgbBuffer): CheckcarWatermarkHit | null {
  const hit = detectCheckcarVinWatermark(img);
  if (!hit) return null;
  applyGrayMosaicBar(img, hit.box);
  return hit;
}
