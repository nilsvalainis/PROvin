import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { rgb, type PDFFont, type PDFDocument, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";

/** Kopīgs Dzintarzeme PDF (tāme, pasūtījums) — krāsas un kartīšu zīmēšana. */
export const INK = rgb(17 / 255, 24 / 255, 39 / 255);
export const MUTED = rgb(82 / 255, 82 / 255, 91 / 255);
export const SEC_HEAD = rgb(63 / 255, 63 / 255, 70 / 255);
export const ACCENT_BAR = rgb(55 / 255, 65 / 255, 75 / 255);
export const SEC_CARD_FILL = rgb(244 / 255, 244 / 255, 245 / 255);
export const SEC_CARD_BORDER = rgb(212 / 255, 212 / 255, 216 / 255);
export const SEC_SHADOW = rgb(228 / 255, 228 / 255, 231 / 255);

export const LETTER_TRACKING = 0.18;
export const FOOTER_BLOCK_H = 96;
export const SECTION_GAP = 10;
export const CARD_RADIUS = 6;
export const SHADOW_OFFSET = 1.25;

const DZINTARZEME_OFFER_LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "brands",
  "dzintarzeme-iriss-offer-pdf-logo.png",
);

export type LogoPack = { img: PDFImage; dw: number; dh: number };

export function lineHeight(size: number): number {
  return Math.round(size * 1.35);
}

export function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (measureTrackedWidth(test, font, fontSize, LETTER_TRACKING) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function measureTrackedWidth(text: string, font: PDFFont, size: number, tracking = 0): number {
  if (!text) return 0;
  const chars = Array.from(text);
  let width = 0;
  for (const ch of chars) width += font.widthOfTextAtSize(ch, size);
  if (chars.length > 1) width += tracking * (chars.length - 1);
  return width;
}

export function drawTrackedText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; tracking?: number },
) {
  const tracking = opts.tracking ?? LETTER_TRACKING;
  if (!text) return;
  let cursor = opts.x;
  for (const ch of Array.from(text)) {
    page.drawText(ch, {
      x: cursor,
      y: opts.y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    cursor += opts.font.widthOfTextAtSize(ch, opts.size) + tracking;
  }
}

export function drawRoundedRect(
  page: PDFPage,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
  },
) {
  const r = Math.max(0, Math.min(opts.radius, Math.min(opts.width, opts.height) / 2));
  const x0 = opts.x;
  const y0 = opts.y;
  const x1 = opts.x + opts.width;
  const y1 = opts.y + opts.height;
  const pathData = [
    `M ${x0 + r} ${y1}`,
    `L ${x1 - r} ${y1}`,
    `A ${r} ${r} 0 0 1 ${x1} ${y1 - r}`,
    `L ${x1} ${y0 + r}`,
    `A ${r} ${r} 0 0 1 ${x1 - r} ${y0}`,
    `L ${x0 + r} ${y0}`,
    `A ${r} ${r} 0 0 1 ${x0} ${y0 + r}`,
    `L ${x0} ${y1 - r}`,
    `A ${r} ${r} 0 0 1 ${x0 + r} ${y1}`,
    "Z",
  ].join(" ");
  page.drawSvgPath(pathData, {
    color: opts.color,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth ?? 0,
  });
}

export function drawSectionCardWithShadow(
  page: PDFPage,
  opts: { x: number; yBottom: number; w: number; h: number; fill: ReturnType<typeof rgb> },
): void {
  const { x, yBottom, w, h, fill } = opts;
  const r = CARD_RADIUS;
  drawRoundedRect(page, {
    x: x + SHADOW_OFFSET,
    y: yBottom - SHADOW_OFFSET,
    width: w,
    height: h,
    radius: r,
    color: SEC_SHADOW,
  });
  drawRoundedRect(page, {
    x,
    y: yBottom,
    width: w,
    height: h,
    radius: r,
    color: fill,
    borderColor: SEC_CARD_BORDER,
    borderWidth: 0.75,
  });
}

export function drawSectionHeadInCard(
  page: PDFPage,
  ix: number,
  yTop: number,
  titleDisplay: string,
  fontBold: PDFFont,
): number {
  const fs = 8.5;
  const barW = 2;
  const barH = lineHeight(fs) + 1;
  page.drawRectangle({
    x: ix,
    y: yTop - barH + 1,
    width: barW,
    height: barH,
    color: ACCENT_BAR,
  });
  drawTrackedText(page, titleDisplay, {
    x: ix + barW + 6,
    y: yTop - fs,
    size: fs,
    font: fontBold,
    color: SEC_HEAD,
    tracking: 0.08,
  });
  return lineHeight(fs) + 8;
}

export function drawFittedOneLine(
  page: PDFPage,
  text: string,
  font: PDFFont,
  x: number,
  yBaseline: number,
  maxW: number,
  maxSize: number,
  minSize: number,
  color: ReturnType<typeof rgb>,
  tracking: number,
): number {
  let s = maxSize;
  while (s >= minSize) {
    if (measureTrackedWidth(text, font, s, tracking) <= maxW) {
      drawTrackedText(page, text, { x, y: yBaseline - s, size: s, font, color, tracking });
      return lineHeight(s);
    }
    s -= 0.35;
  }
  let t = text;
  const ell = "…";
  while (t.length > 1) {
    t = t.slice(0, -1);
    const tryText = t + ell;
    if (measureTrackedWidth(tryText, font, minSize, tracking) <= maxW) {
      drawTrackedText(page, tryText, {
        x,
        y: yBaseline - minSize,
        size: minSize,
        font,
        color,
        tracking,
      });
      return lineHeight(minSize);
    }
  }
  drawTrackedText(page, ell, {
    x,
    y: yBaseline - minSize,
    size: minSize,
    font,
    color,
    tracking,
  });
  return lineHeight(minSize);
}

export async function loadOfferLogoPack(pdfDoc: PDFDocument): Promise<LogoPack | null> {
  try {
    const sourceBuf = await fs.readFile(DZINTARZEME_OFFER_LOGO_PATH);
    const { data, info } = await sharp(sourceBuf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (r < 72 && g < 72 && b < 72) {
        data[i + 3] = 0;
      }
    }
    const buf = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .png()
      .toBuffer();
    let img: PDFImage;
    try {
      img = await pdfDoc.embedPng(buf);
    } catch {
      img = await pdfDoc.embedJpg(buf);
    }
    const maxW = 160;
    const maxH = 40;
    const s = Math.min(maxW / img.width, maxH / img.height, 1);
    return { img, dw: img.width * s, dh: img.height * s };
  } catch {
    return null;
  }
}

export type DzFooterCtx = {
  page: PDFPage;
  margin: number;
  font: PDFFont;
  fontBold: PDFFont;
};

export function drawDzintarzemePdfFooter(ctx: DzFooterCtx, logo: LogoPack | null): void {
  const page = ctx.page;
  const m = ctx.margin;
  const footerLines = [
    "Dzintarzeme Auto",
    "00 371 204 205 39",
    "00 371 277 334 40",
    "info@dzintarzemeauto.lv",
    "www.dzintarzemeauto.lv",
  ];
  const fs = 7.5;
  const lh = lineHeight(fs);
  const textBlockH = footerLines.length * lh;
  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const s = Math.min(88 / logo.dw, 24 / logo.dh, 1);
    logoW = logo.dw * s;
    logoH = logo.dh * s;
  }
  const blockH = Math.max(textBlockH, logoH);
  let tx = m;
  if (logo) {
    const logoY = m + 8 + (blockH - logoH) / 2;
    page.drawImage(logo.img, { x: m, y: logoY, width: logoW, height: logoH });
    tx = m + logoW + 10;
  }
  let ty = m + 8 + blockH;
  for (const ln of footerLines) {
    drawTrackedText(page, ln, {
      x: tx,
      y: ty - fs,
      size: fs,
      font: ln.includes("@") || ln.startsWith("www") ? ctx.font : ctx.fontBold,
      color: ln === "Dzintarzeme Auto" ? INK : MUTED,
      tracking: 0.04,
    });
    ty -= lh;
  }
}
