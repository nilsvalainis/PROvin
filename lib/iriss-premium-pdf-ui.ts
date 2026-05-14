import "server-only";

import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { IRISS_BRAND_ORANGE_HEX } from "@/lib/iriss-brand";
import { drawRoundedRect, drawTrackedText, wrapText, type LogoPack } from "@/lib/dzintarzeme-pdf-layout";

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export const PREMIUM_ORANGE = hexToRgb(IRISS_BRAND_ORANGE_HEX);
export const PREMIUM_SLATE = rgb(15 / 255, 23 / 255, 42 / 255);
export const PREMIUM_MUTED = rgb(71 / 255, 85 / 255, 105 / 255);
export const PREMIUM_PANEL = rgb(248 / 255, 250 / 255, 252 / 255);
export const PREMIUM_HIGHLIGHT_FILL = rgb(255 / 255, 248 / 255, 245 / 255);
export const PREMIUM_HEADER_AFTER_RULE_GAP = 40;
/** Rezerve satura apakšā — 3 kol. kājenei + logo. */
export const PREMIUM_FOOTER_BLOCK_H = 102;
const TRACK_TIGHT = 0.08;

/** Rindiņas augstums 1,52× — „premium” lasāmība. */
export function premiumLineHeight(fs: number): number {
  return Math.round(fs * 1.52);
}

export function stampOfferLogoTopRight(
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  logo: LogoPack,
): void {
  const x = pageW - margin - logo.dw;
  const y = pageH - margin - logo.dh;
  page.drawImage(logo.img, { x, y, width: logo.dw, height: logo.dh });
}

export type PremiumHeaderMutableCtx = {
  page: PDFPage;
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
};

/**
 * Rēķina „premium” galvene: virsraksts kreisajā, logo labajā augšējā stūrī,
 * tieši zem virsraksta — pilna platuma melnā līnija (2 px slate), tad apakšvirsraksti un atstarpe.
 */
export function drawPremiumInvoiceHeader(
  ctx: PremiumHeaderMutableCtx,
  logo: LogoPack | null,
  docTitle: string,
  sublines: string[],
  opts?: { titleMax?: number; titleMin?: number },
): void {
  const { page, pageW, pageH, margin, contentW, font, fontBold } = ctx;
  const titleMax = opts?.titleMax ?? 12;
  const titleMin = opts?.titleMin ?? 8.5;
  const rightPad = logo ? logo.dw + 18 : 0;
  const titleColW = Math.max(160, contentW - rightPad);

  if (logo) stampOfferLogoTopRight(page, pageW, pageH, margin, logo);

  let cy = ctx.y;
  let titleSize = titleMax;
  while (titleSize >= titleMin) {
    const lines = wrapText(docTitle.toLocaleUpperCase("lv-LV"), fontBold, titleSize, titleColW);
    const blockH = lines.length * premiumLineHeight(titleSize);
    const logoBottom = logo ? pageH - margin - logo.dh : cy;
    if (!logo || cy - blockH >= logoBottom - 4 || titleSize <= titleMin + 0.01) {
      for (const ln of lines) {
        drawTrackedText(page, ln, {
          x: margin,
          y: cy - titleSize,
          size: titleSize,
          font: fontBold,
          color: PREMIUM_SLATE,
          tracking: TRACK_TIGHT,
        });
        cy -= premiumLineHeight(titleSize);
      }
      break;
    }
    titleSize -= 0.35;
  }

  const RULE_THICK = 2;
  const gapUnderTitle = 5;
  const yRule = cy - gapUnderTitle - RULE_THICK;
  page.drawRectangle({
    x: margin,
    y: yRule,
    width: contentW,
    height: RULE_THICK,
    color: PREMIUM_SLATE,
  });
  cy = yRule - 8;

  for (const sl of sublines) {
    if (!sl.trim()) continue;
    for (const ln of wrapText(sl, font, 9, titleColW)) {
      drawTrackedText(page, ln, {
        x: margin,
        y: cy - 9,
        size: 9,
        font,
        color: PREMIUM_MUTED,
        tracking: 0.05,
      });
      cy -= premiumLineHeight(9);
    }
  }

  ctx.y = cy - PREMIUM_HEADER_AFTER_RULE_GAP;
}

/** Kājene: 3 kolonnas ar vertikālām atdalītājlīnijām (Dzintarzeme kontakti). */
export function drawPremiumFooter3ColDz(
  page: PDFPage,
  margin: number,
  contentW: number,
  font: PDFFont,
  fontBold: PDFFont,
  logo: LogoPack | null,
): void {
  const m = margin;
  const col1 = "00 371 204 205 39\n00 371 277 334 40";
  const col2 = "info@dzintarzemeauto.lv";
  const col3 = "www.dzintarzemeauto.lv";
  const brand = "Dzintarzeme Auto";
  const fs = 7.5;
  const lh = premiumLineHeight(fs);
  const brandFs = 8;
  const lhBrand = premiumLineHeight(brandFs);
  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const s = Math.min(88 / logo.dw, 26 / logo.dh, 1);
    logoW = logo.dw * s;
    logoH = logo.dh * s;
  }
  const colRows = Math.max(col1.split("\n").length, 1, col2.split("\n").length, col3.split("\n").length);
  const colsH = colRows * lh + 4;
  const blockH = Math.max(colsH + lhBrand + 6, logoH + 8);
  let tx = m;
  if (logo) {
    const logoY = m + 8 + (blockH - logoH) / 2;
    page.drawImage(logo.img, { x: m, y: logoY, width: logoW, height: logoH });
    tx = m + logoW + 12;
  }
  const usableW = contentW - (tx - m);
  const cw = usableW / 3;
  const divColor = rgb(220 / 255, 226 / 255, 232 / 255);
  const x1 = tx + cw;
  const x2 = tx + cw * 2;

  const ty = m + 8 + blockH;
  drawTrackedText(page, brand, {
    x: tx,
    y: ty - brandFs,
    size: brandFs,
    font: fontBold,
    color: PREMIUM_SLATE,
    tracking: 0.06,
  });
  const colStartY = ty - lhBrand - 6;
  /** Vertikālās līnijas tikai kolonnu teksta augstumā (bez liekas „kājas”). */
  const divH = colRows * lh;
  const divY = colStartY - divH;

  const drawCol = (text: string, x0: number) => {
    let tyy = colStartY;
    for (const part of text.split("\n")) {
      drawTrackedText(page, part, {
        x: x0 + 4,
        y: tyy - fs,
        size: fs,
        font,
        color: PREMIUM_MUTED,
        tracking: 0.04,
      });
      tyy -= lh;
    }
  };
  drawCol(col1, tx);
  page.drawRectangle({
    x: x1,
    y: divY,
    width: 0.5,
    height: divH,
    color: divColor,
  });
  drawCol(col2, x1);
  page.drawRectangle({
    x: x2,
    y: divY,
    width: 0.5,
    height: divH,
    color: divColor,
  });
  drawCol(col3, x2);
}

function splitIrissFooterIntoCols(lines: string[]): { c1: string; c2: string; c3: string } {
  const brand = lines[0]?.trim() ?? "SIA IRISS";
  const phones: string[] = [];
  const addr: string[] = [];
  const web: string[] = [];
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    if (/https?:\/\//i.test(line) || /\bwww\./i.test(line)) web.push(line);
    else if (line.includes("@")) web.push(line);
    else if (/\+?\d[\d\s\-()]{6,}/.test(line)) phones.push(line);
    else addr.push(line);
  }
  return {
    c1: [brand, ...phones].filter(Boolean).join("\n"),
    c2: addr.length ? addr.join("\n") : "—",
    c3: web.length ? web.join("\n") : "—",
  };
}

/** Kājene pēc `IRISS_PDF_SUPPLIER_LINES_JSON` — 3 kolonnas. */
export function drawPremiumFooter3ColIriss(
  page: PDFPage,
  margin: number,
  contentW: number,
  font: PDFFont,
  fontBold: PDFFont,
  lines: string[],
): void {
  const m = margin;
  const { c1, c2, c3 } = splitIrissFooterIntoCols(lines);
  const brandKey = lines[0]?.trim() ?? "";
  const fs = 7.5;
  const lh = premiumLineHeight(fs);
  const cw = contentW / 3;
  const x1 = m + cw;
  const x2 = m + cw * 2;
  const divColor = rgb(220 / 255, 226 / 255, 232 / 255);

  const colParts = (t: string) => t.split("\n").filter((x) => x.trim());
  const colStackH = (text: string): number => {
    const parts = colParts(text);
    let h = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const isBrand = i === 0 && p === brandKey;
      h += isBrand ? premiumLineHeight(8) : lh;
    }
    return h;
  };
  const bodyH = Math.max(lh, colStackH(c1), colStackH(c2), colStackH(c3));
  const blockH = bodyH + 10;

  const drawCol = (text: string, x0: number) => {
    let ty = m + 8 + blockH;
    const parts = colParts(text);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const isBrand = i === 0 && p === brandKey;
      const s = isBrand ? 8 : fs;
      const f = isBrand ? fontBold : font;
      drawTrackedText(page, p, {
        x: x0 + 4,
        y: ty - s,
        size: s,
        font: f,
        color: isBrand ? PREMIUM_SLATE : PREMIUM_MUTED,
        tracking: isBrand ? 0.05 : 0.04,
      });
      ty -= isBrand ? premiumLineHeight(s) : lh;
    }
  };

  const footerTop = m + 8 + blockH;
  const divY = footerTop - bodyH;

  drawCol(c1, m);
  page.drawRectangle({ x: x1, y: divY, width: 0.5, height: bodyH, color: divColor });
  drawCol(c2, x1);
  page.drawRectangle({ x: x2, y: divY, width: 0.5, height: bodyH, color: divColor });
  drawCol(c3, x2);
}

export type OfferIconKind = "odometer" | "transmission" | "fuel" | "location" | "calendar" | "car";

const ICON_PATHS: Record<OfferIconKind, string> = {
  odometer:
    "M 12 3 C 7.03 3 3 7.03 3 12 C 3 16.97 7.03 21 12 21 C 16.97 21 21 16.97 21 12 C 21 7.03 16.97 3 12 3 Z M 12 6 L 12 12 L 16 14",
  transmission:
    "M 12 2 L 14 7 L 19 7 L 15.5 10.5 L 17 16 L 12 13 L 7 16 L 8.5 10.5 L 5 7 L 10 7 Z",
  fuel: "M 4 18 L 4 22 L 9 22 L 9 18 L 7 14 L 7 9 L 5 9 L 5 14 Z M 10 11 L 16 11 L 16 22 L 10 22 Z M 12 7 L 12 11",
  location:
    "M 12 2 C 8.13 2 5 5.13 5 9 C 5 14.25 12 22 12 22 C 12 22 19 14.25 19 9 C 19 5.13 15.87 2 12 2 Z M 12 11.5 C 10.62 11.5 9.5 10.38 9.5 9 C 9.5 7.62 10.62 6.5 12 6.5 C 13.38 6.5 14.5 7.62 14.5 9 C 14.5 10.38 13.38 11.5 12 11.5 Z",
  calendar: "M 5 4 H 19 V 20 H 5 Z M 5 9 H 19 M 8 2 V 6 M 16 2 V 6",
  car: "M 5 16 L 6 12 H 18 L 19 16 V 18 H 5 Z M 6 12 L 7 9 H 17 L 18 12 M 8 18 V 20 M 16 18 V 20",
};

export function matchOfferLineIcon(labelPart: string): OfferIconKind | null {
  const t = labelPart.toLowerCase();
  if (t.includes("odomet")) return "odometer";
  if (t.includes("transmis")) return "transmission";
  if (t.includes("dzinē") || t.includes("degviel") || t.includes("fuel")) return "fuel";
  if (t.includes("atrašan") || t.includes("location")) return "location";
  if (t.includes("reģistrāc") || t.includes("gads")) return "calendar";
  if (t.includes("marka") || t.includes("model")) return "car";
  return null;
}

export function drawOfferMiniIcon(
  page: PDFPage,
  kind: OfferIconKind,
  x: number,
  baselineY: number,
  sizePx: number,
  color: ReturnType<typeof rgb>,
): void {
  const sc = sizePx / 24;
  const path = ICON_PATHS[kind];
  page.drawSvgPath(path, {
    x,
    y: baselineY - sizePx * 0.88,
    scale: sc,
    color,
    borderColor: color,
    borderWidth: 0,
  });
}

/** Apmaļots attēla rāmis (5 px radius) — oranža kontūra, balts fons. */
export function drawImageInPremiumFrame(
  page: PDFPage,
  img: { width: number; height: number },
  drawImg: (dx: number, dy: number, dw: number, dh: number) => void,
  cellX: number,
  cellTopY: number,
  cellW: number,
  cellH: number,
): void {
  const pad = 4;
  const r = 5;
  const innerW = cellW - pad * 2;
  const innerH = cellH - pad * 2;
  const s = Math.min(innerW / img.width, innerH / img.height, 1);
  const dw = img.width * s;
  const dh = img.height * s;
  const ix = cellX + pad + (innerW - dw) / 2;
  const iy = cellTopY - pad - dh;
  const bx = cellX;
  const by = cellTopY - cellH;
  drawRoundedRect(page, {
    x: bx,
    y: by,
    width: cellW,
    height: cellH,
    radius: r,
    color: rgb(1, 1, 1),
    borderColor: PREMIUM_ORANGE,
    borderWidth: 0.85,
  });
  drawImg(ix, iy, dw, dh);
}
