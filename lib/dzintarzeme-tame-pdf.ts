import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";

import { computeDzintarzemeTame, type DzintarzemeTameInput } from "@/lib/dzintarzeme-tame-calculator";

/** PROVIN audita PDF / drukas — primārais zils (`client-report-pdf-layout-draft`). */
const PDF_BRAND_BLUE_HEX = "#0061D2";

const INTER_REG_PATH = path.join(process.cwd(), "public", "fonts", "invoice-inter", "Inter-Regular.ttf");
const INTER_BOLD_PATH = path.join(process.cwd(), "public", "fonts", "invoice-inter", "Inter-Bold.ttf");
const DZINTARZEME_OFFER_LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "brands",
  "dzintarzeme-iriss-offer-pdf-logo.png",
);

let interFontBytesCache: Promise<{ reg: Uint8Array; bold: Uint8Array }> | null = null;

async function loadInterFontBytes(): Promise<{ reg: Uint8Array; bold: Uint8Array }> {
  if (!interFontBytesCache) {
    interFontBytesCache = (async () => {
      const [regBuf, boldBuf] = await Promise.all([fs.readFile(INTER_REG_PATH), fs.readFile(INTER_BOLD_PATH)]);
      return { reg: new Uint8Array(regBuf), bold: new Uint8Array(boldBuf) };
    })();
  }
  return interFontBytesCache;
}

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const INK = rgb(17 / 255, 24 / 255, 39 / 255);
const MUTED = rgb(71 / 255, 85 / 255, 105 / 255);
const SEC_HEAD = rgb(71 / 255, 85 / 255, 105 / 255);
const RULE = rgb(15 / 255, 23 / 255, 42 / 255);
const TABLE_HEAD_BG = rgb(248 / 255, 250 / 255, 252 / 255);
const ZEBRA_ROW = rgb(249 / 255, 250 / 255, 251 / 255);
const ROW_LINE = rgb(224 / 255, 224 / 255, 224 / 255);
const PANEL_BORDER = rgb(241 / 255, 245 / 255, 249 / 255);
const PANEL_FILL = rgb(255, 255, 255);
const NOTE_FILL = rgb(250 / 255, 250 / 255, 250 / 255);
const NOTE_BORDER = rgb(226 / 255, 232 / 255, 240 / 255);
const BRAND_BLUE = hexToRgb(PDF_BRAND_BLUE_HEX);
const GALA_BAND = rgb(248 / 255, 250 / 255, 252 / 255);
const GALA_BORDER = rgb(226 / 255, 232 / 255, 240 / 255);

/**
 * Informatīvs atgādinājums (PVN likums, 138.pants — peļņas daļas režīms).
 */
const LV_PVN_TAME_LEGAL_NOTE =
  "Lietotam transportlīdzeklim piemērots PVN likuma 138. panta režīms (peļņas daļas nodoklis). Komisijas maksai un papildu pakalpojumiem piemērota PVN standartlikme 21%. PVN kopsumma norādīta kopsavilkumā.";
const LETTER_TRACKING = 0.242;
const FOOTER_SAFE = 56;
const LOGO_ONLY_BAND = 46;
const SECTION_GAP = 22;

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
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

function lineHeight(size: number): number {
  return Math.round(size * 1.5);
}

function measureTrackedWidth(text: string, font: PDFFont, size: number, tracking = 0): number {
  if (!text) return 0;
  const chars = Array.from(text);
  let width = 0;
  for (const ch of chars) width += font.widthOfTextAtSize(ch, size);
  if (chars.length > 1) width += tracking * (chars.length - 1);
  return width;
}

function drawTrackedText(
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

function drawRoundedRect(
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

type LogoPack = { img: PDFImage; dw: number; dh: number };

type PdfCtx = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  margin: number;
  contentW: number;
  pageW: number;
  pageH: number;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  offerLogo: LogoPack | null;
  logoOnlyBand: number;
};

function stampOfferLogoTopLeft(page: PDFPage, pageH: number, margin: number, logo: LogoPack): void {
  const yRect = pageH - margin - logo.dh;
  page.drawImage(logo.img, {
    x: margin,
    y: yRect,
    width: logo.dw,
    height: logo.dh,
  });
}

function ensureSpace(ctx: PdfCtx, need: number): void {
  if (ctx.y - need < ctx.margin + FOOTER_SAFE) {
    ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
    if (ctx.offerLogo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, ctx.offerLogo);
    ctx.y = ctx.pageH - ctx.margin - (ctx.offerLogo ? ctx.logoOnlyBand : 0);
  }
}

async function loadOfferLogoPack(pdfDoc: PDFDocument): Promise<LogoPack | null> {
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

function fmtMoneyEurLv(n: number): string {
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

async function createCtx(): Promise<PdfCtx> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { reg, bold } = await loadInterFontBytes();
  const font = await pdfDoc.embedFont(reg, { subset: false });
  const fontBold = await pdfDoc.embedFont(bold, { subset: false });
  const pageW = 595;
  const pageH = 842;
  const margin = 48;
  const contentW = pageW - margin * 2;
  return {
    pdfDoc,
    page: pdfDoc.addPage([pageW, pageH]),
    margin,
    contentW,
    pageW,
    pageH,
    font,
    fontBold,
    y: pageH - margin,
    offerLogo: null,
    logoOnlyBand: LOGO_ONLY_BAND,
  };
}

function drawRule(ctx: PdfCtx): void {
  const h = 1;
  ensureSpace(ctx, h + 16);
  const yb = ctx.y - h;
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yb,
    width: ctx.contentW,
    height: h,
    color: RULE,
  });
  ctx.y = yb - 18;
}

/** PROVIN audita sekciju virsrakstu stils: kreisā zilā maliņa + uppercase. */
function drawAuditSectionHead(ctx: PdfCtx, titleUpper: string): void {
  const fs = 10;
  const barW = 2;
  const barH = lineHeight(fs) + 2;
  const lh = lineHeight(fs) + 10;
  ensureSpace(ctx, lh + 8);
  const yTop = ctx.y;
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yTop - barH + 1,
    width: barW,
    height: barH,
    color: BRAND_BLUE,
  });
  drawTrackedText(ctx.page, titleUpper.toLocaleUpperCase("lv-LV"), {
    x: ctx.margin + barW + 8,
    y: yTop - fs,
    size: fs,
    font: ctx.fontBold,
    color: SEC_HEAD,
    tracking: 0.1,
  });
  ctx.y = yTop - lh;
}

function measureVehicleCardHeight(ctx: PdfCtx, bm: string, vin: string): number {
  const b = bm.trim();
  const v = vin.trim();
  const iw = ctx.contentW - 28;
  let h = 16 + lineHeight(10) + 12;
  if (b) {
    const lines = wrapText(b, ctx.fontBold, 14, iw).length;
    h += lineHeight(12) + 5 + lines * lineHeight(14) + 18;
  }
  if (v) {
    const lines = wrapText(v.toUpperCase(), ctx.fontBold, 13, iw).length;
    h += lineHeight(12) + 5 + lines * lineHeight(13) + 18;
  }
  h += 16;
  return h;
}

/** Izcelts identifikācijas bloks — lielāki BOLD, PROVIN audita paneļa līdzīgs rāmis. */
function drawVehicleInfoCard(ctx: PdfCtx, bm: string, vin: string): void {
  const b = bm.trim();
  const v = vin.trim();
  if (!b && !v) return;

  const innerPad = 14;
  const cardW = ctx.contentW;
  const h = measureVehicleCardHeight(ctx, bm, vin);
  ensureSpace(ctx, h + SECTION_GAP);
  const yTop = ctx.y;
  const yBottom = yTop - h;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: yBottom,
    width: cardW,
    height: h,
    radius: 8,
    color: PANEL_FILL,
    borderColor: PANEL_BORDER,
    borderWidth: 1,
  });

  let cy = yTop - innerPad;
  const ix = ctx.margin + innerPad;
  const iw = cardW - innerPad * 2;

  drawAuditSectionHeadWithin(ctx, ix, cy, iw, "Identifikācija");
  cy -= lineHeight(10) + 14;

  if (b) {
    drawTrackedText(ctx.page, "Marka / modelis:", {
      x: ix,
      y: cy - 12,
      size: 12,
      font: ctx.fontBold,
      color: INK,
      tracking: 0.08,
    });
    cy -= lineHeight(12) + 5;
    for (const ln of wrapText(b, ctx.fontBold, 14, iw)) {
      drawTrackedText(ctx.page, ln, {
        x: ix,
        y: cy - 14,
        size: 14,
        font: ctx.fontBold,
        color: INK,
        tracking: LETTER_TRACKING,
      });
      cy -= lineHeight(14);
    }
    cy -= 14;
  }

  if (v) {
    drawTrackedText(ctx.page, "VIN:", {
      x: ix,
      y: cy - 12,
      size: 12,
      font: ctx.fontBold,
      color: INK,
      tracking: 0.08,
    });
    cy -= lineHeight(12) + 5;
    for (const ln of wrapText(v.toUpperCase(), ctx.fontBold, 13, iw)) {
      drawTrackedText(ctx.page, ln, {
        x: ix,
        y: cy - 13,
        size: 13,
        font: ctx.fontBold,
        color: INK,
        tracking: 0.14,
      });
      cy -= lineHeight(13);
    }
  }

  ctx.y = yBottom - SECTION_GAP;
}

/** Kompakts sekcijas virsraksts iekš kartītes (bez papildu `ctx.y` globāla soļa). */
function drawAuditSectionHeadWithin(ctx: PdfCtx, ix: number, yTop: number, iw: number, title: string): void {
  const fs = 10;
  const barW = 2;
  const barH = lineHeight(fs) + 2;
  ctx.page.drawRectangle({
    x: ix,
    y: yTop - barH + 1,
    width: barW,
    height: barH,
    color: BRAND_BLUE,
  });
  drawTrackedText(ctx.page, title.toLocaleUpperCase("lv-LV"), {
    x: ix + barW + 8,
    y: yTop - fs,
    size: fs,
    font: ctx.fontBold,
    color: SEC_HEAD,
    tracking: 0.1,
  });
}

/** Dzintarzeme Auto tāmes PDF — tikai logo, saturs un disclaimer (bez ģenerētās kājenes ar piegādātāju). */
export async function generateDzintarzemeTamePdfBytes(input: DzintarzemeTameInput): Promise<Uint8Array> {
  const c = computeDzintarzemeTame(input);
  const ctx = await createCtx();
  ctx.offerLogo = await loadOfferLogoPack(ctx.pdfDoc);
  ctx.logoOnlyBand = ctx.offerLogo ? Math.max(LOGO_ONLY_BAND, Math.ceil(ctx.offerLogo.dh + 20)) : LOGO_ONLY_BAND;

  const logo = ctx.offerLogo;
  const heroNeed = Math.max(logo ? logo.dh + 24 : 0, lineHeight(16) + lineHeight(11) + 28);
  ensureSpace(ctx, heroNeed);

  if (logo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, logo);

  const title = "Automašīnas pasūtījuma izmaksu tāme";
  const titleX = ctx.margin + (logo ? logo.dw + 14 : 0);
  const titleW = ctx.contentW - (logo ? logo.dw + 14 : 0);
  const titleLines = wrapText(title, ctx.fontBold, 16, titleW);
  let ty = ctx.y;
  for (const ln of titleLines) {
    drawTrackedText(ctx.page, ln, {
      x: titleX,
      y: ty - 16,
      size: 16,
      font: ctx.fontBold,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    ty -= lineHeight(16);
  }
  const logoBottom = logo ? ctx.pageH - ctx.margin - logo.dh - 6 : ctx.y;
  const titleBottom = ctx.y - titleLines.length * lineHeight(16);
  ctx.y = Math.min(logoBottom, titleBottom) - 10;

  const dateStr = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());
  drawTrackedText(ctx.page, dateStr, {
    x: ctx.margin,
    y: ctx.y - 10,
    size: 10,
    font: ctx.font,
    color: MUTED,
    tracking: LETTER_TRACKING,
  });
  ctx.y -= lineHeight(10) + 8;
  drawRule(ctx);
  ctx.y -= 6;

  drawVehicleInfoCard(ctx, c.input.brandModel, c.input.vin);

  drawAuditSectionHead(ctx, "Pozīcijas");
  ctx.y -= 6;

  const innerPad = 10;
  const tableInnerW = ctx.contentW - innerPad * 2;
  const colAmountRight = ctx.margin + ctx.contentW - innerPad - 2;
  const labelWrapW = Math.max(160, ctx.contentW - innerPad * 2 - 108);

  const visibleRows = c.tableRows.filter((r) => r.net > 0);
  const lh10 = lineHeight(10);
  const lh72 = lineHeight(7.2);
  const headerH = lineHeight(10) + 10;

  let bodyH = 0;
  let ri = 0;
  for (const row of visibleRows) {
    const labelLines = wrapText(row.label, ctx.font, 10, labelWrapW);
    const subH = row.subtitle ? lh72 : 0;
    bodyH += Math.max(labelLines.length * lh10, lh10) + subH + 10;
    if (ri < visibleRows.length - 1) bodyH += 1;
    ri++;
  }

  const tableFrameH = innerPad + headerH + bodyH + innerPad + 2;
  ensureSpace(ctx, tableFrameH + SECTION_GAP);
  const tableTop = ctx.y;
  const tableBottom = tableTop - tableFrameH;

  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: tableBottom,
    width: ctx.contentW,
    height: tableFrameH,
    radius: 8,
    color: PANEL_FILL,
    borderColor: PANEL_BORDER,
    borderWidth: 1,
  });

  let cy = tableTop - innerPad;
  const headBottom = cy - headerH;
  ctx.page.drawRectangle({
    x: ctx.margin + 1,
    y: headBottom,
    width: ctx.contentW - 2,
    height: headerH,
    color: TABLE_HEAD_BG,
  });
  ctx.page.drawRectangle({
    x: ctx.margin + innerPad,
    y: headBottom,
    width: tableInnerW,
    height: 0.55,
    color: ROW_LINE,
  });

  drawTrackedText(ctx.page, "Apraksts", {
    x: ctx.margin + innerPad + 2,
    y: cy - 10,
    size: 10,
    font: ctx.fontBold,
    color: MUTED,
    tracking: 0.12,
  });
  const netHdr = "EUR (neto)";
  const netHdrW = measureTrackedWidth(netHdr, ctx.fontBold, 10, 0.12);
  drawTrackedText(ctx.page, netHdr, {
    x: colAmountRight - netHdrW,
    y: cy - 10,
    size: 10,
    font: ctx.fontBold,
    color: MUTED,
    tracking: 0.12,
  });
  cy = headBottom - 2;

  for (let i = 0; i < visibleRows.length; i++) {
    const row = visibleRows[i]!;
    const labelLines = wrapText(row.label, ctx.font, 10, labelWrapW);
    const subH = row.subtitle ? lh72 : 0;
    const rowH = Math.max(labelLines.length * lh10, lh10) + subH + 10;
    const rowTop = cy;
    const rowBottom = rowTop - rowH;

    if (i % 2 === 1) {
      ctx.page.drawRectangle({
        x: ctx.margin + 2,
        y: rowBottom,
        width: ctx.contentW - 4,
        height: rowH,
        color: ZEBRA_ROW,
      });
    }

    let ly = rowTop;
    for (const ll of labelLines) {
      drawTrackedText(ctx.page, ll, {
        x: ctx.margin + innerPad + 4,
        y: ly - 10,
        size: 10,
        font: ctx.fontBold,
        color: INK,
        tracking: 0.1,
      });
      ly -= lh10;
    }
    if (row.subtitle) {
      drawTrackedText(ctx.page, row.subtitle, {
        x: ctx.margin + innerPad + 4,
        y: ly - 7.2,
        size: 7.2,
        font: ctx.font,
        color: MUTED,
        tracking: 0.06,
      });
    }

    const amt = fmtMoneyEurLv(row.net);
    const amtW = measureTrackedWidth(amt, ctx.fontBold, 11, 0.12);
    drawTrackedText(ctx.page, amt, {
      x: colAmountRight - amtW,
      y: rowTop - 10,
      size: 11,
      font: ctx.fontBold,
      color: INK,
      tracking: 0.12,
    });

    ctx.page.drawRectangle({
      x: ctx.margin + innerPad,
      y: rowBottom,
      width: tableInnerW,
      height: 0.45,
      color: ROW_LINE,
    });

    cy = rowBottom;
  }

  ctx.y = tableBottom - SECTION_GAP;

  const noteLines = wrapText(LV_PVN_TAME_LEGAL_NOTE, ctx.font, 8, ctx.contentW - 24);
  const noteH = noteLines.length * lineHeight(8) + 22;
  ensureSpace(ctx, noteH + SECTION_GAP);
  const noteTop = ctx.y;
  const noteBottom = noteTop - noteH;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: noteBottom,
    width: ctx.contentW,
    height: noteH,
    radius: 6,
    color: NOTE_FILL,
    borderColor: NOTE_BORDER,
    borderWidth: 1,
  });
  let ny = noteTop - 12;
  for (const ln of noteLines) {
    drawTrackedText(ctx.page, ln, {
      x: ctx.margin + 12,
      y: ny - 8,
      size: 8,
      font: ctx.font,
      color: MUTED,
      tracking: 0.05,
    });
    ny -= lineHeight(8);
  }
  ctx.y = noteBottom - SECTION_GAP;

  const sumTopPad = 12;
  const sumHeadH = lineHeight(10) + 12;
  const sumRowGap = 10;
  const sumRowHNormal = lineHeight(11) + sumRowGap;
  const sumRowHGala = lineHeight(12) + 18;
  const sumBottomPad = 14;
  const sumFrameH =
    sumTopPad + sumHeadH + sumRowHNormal * 2 + 8 + sumRowHGala + sumBottomPad;
  ensureSpace(ctx, sumFrameH + SECTION_GAP);
  const sumTop = ctx.y;
  const sumBottom = sumTop - sumFrameH;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: sumBottom,
    width: ctx.contentW,
    height: sumFrameH,
    radius: 8,
    color: PANEL_FILL,
    borderColor: PANEL_BORDER,
    borderWidth: 1,
  });

  let sy = sumTop - sumTopPad;
  drawAuditSectionHeadWithin(ctx, ctx.margin + 12, sy, ctx.contentW - 24, "Kopsavilkums");
  sy -= sumHeadH;

  const drawSumRow = (label: string, value: string, opts?: { strong?: boolean; band?: boolean }) => {
    const labFs = opts?.strong ? 12 : 11;
    const valFs = opts?.strong ? 13 : 11;
    const rowH = Math.max(lineHeight(labFs), lineHeight(valFs)) + (opts?.strong ? 12 : sumRowGap);
    if (opts?.band) {
      const bandTop = sy;
      const bandBottom = sy - rowH;
      ctx.page.drawRectangle({
        x: ctx.margin + 2,
        y: bandBottom,
        width: ctx.contentW - 4,
        height: rowH,
        color: GALA_BAND,
      });
      ctx.page.drawRectangle({
        x: ctx.margin + 2,
        y: bandTop - 0.5,
        width: ctx.contentW - 4,
        height: 0.55,
        color: GALA_BORDER,
      });
    }
    const f = opts?.strong ? ctx.fontBold : ctx.font;
    drawTrackedText(ctx.page, label, {
      x: ctx.margin + 14,
      y: sy - labFs,
      size: labFs,
      font: f,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    const vw = measureTrackedWidth(value, ctx.fontBold, valFs, opts?.strong ? 0.12 : LETTER_TRACKING);
    drawTrackedText(ctx.page, value, {
      x: ctx.margin + ctx.contentW - 14 - vw,
      y: sy - valFs,
      size: valFs,
      font: ctx.fontBold,
      color: INK,
      tracking: opts?.strong ? 0.12 : LETTER_TRACKING,
    });
    sy -= rowH;
  };

  drawSumRow("Kopā bez PVN (neto bāze)", fmtMoneyEurLv(c.summaBezPVN));
  drawSumRow("PVN 21 %", fmtMoneyEurLv(c.pvnKopa));
  sy -= 6;
  drawSumRow("GALA SUMMA APMAKSAI", fmtMoneyEurLv(c.galaSumma), { strong: true, band: true });

  ctx.y = sumBottom - SECTION_GAP;

  const disclaimer = "Šis aprēķins ir informatīvs un nav uzskatāms par oficiālu rēķinu.";
  for (const ln of wrapText(disclaimer, ctx.font, 8.5, ctx.contentW - 28)) {
    ensureSpace(ctx, lineHeight(8.5));
    drawTrackedText(ctx.page, ln, {
      x: ctx.margin + 14,
      y: ctx.y - 8.5,
      size: 8.5,
      font: ctx.font,
      color: MUTED,
      tracking: 0.1,
    });
    ctx.y -= lineHeight(8.5);
  }

  return ctx.pdfDoc.save();
}

export const generateDzintarzemeTame = generateDzintarzemeTamePdfBytes;
