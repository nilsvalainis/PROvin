import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";

import { computeDzintarzemeTame, type DzintarzemeTameInput } from "@/lib/dzintarzeme-tame-calculator";

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

const INK = rgb(17 / 255, 24 / 255, 39 / 255);
const MUTED = rgb(71 / 255, 85 / 255, 105 / 255);
const RULE = rgb(15 / 255, 23 / 255, 42 / 255);
const TABLE_HEAD_BG = rgb(248 / 255, 250 / 255, 252 / 255);

/**
 * Informatīvs atgādinājums pēc PVN likuma konteksta (lietotas mantas — 138.pants).
 * Konkrētais režīms un rēķina forma jāapstiprina grāmatvedībai / VID.
 */
const LV_PVN_TAME_LEGAL_NOTE =
  "Attiecībā uz lietotas transportlīdzekļa piegādi, ciktāl tas ir piemērojams, var attiekties Pievienotās vērtības nodokļa likuma 138.pants " +
  "(īpašs nodokļa piemērošanas režīms darījumos ar lietotām mantām, mākslas darbiem, kolekciju priekšmetiem un senlietām). " +
  "Komisijas maksa un papildu pakalpojumi tiek aplikti ar pievienotās vērtības nodokli 21 %; nodokļa summa šajā dokumentā ir norādīta tikai beigu kopsavilkumā.";
const LETTER_TRACKING = 0.242;
const FOOTER_SAFE = 52;
const LOGO_ONLY_BAND = 46;

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
  ensureSpace(ctx, h + 12);
  const yb = ctx.y - h;
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yb,
    width: ctx.contentW,
    height: h,
    color: RULE,
  });
  ctx.y = yb - 14;
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
  ctx.y = Math.min(logoBottom, titleBottom) - 6;

  const dateStr = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());
  drawTrackedText(ctx.page, dateStr, {
    x: ctx.margin,
    y: ctx.y - 10,
    size: 10,
    font: ctx.font,
    color: MUTED,
    tracking: LETTER_TRACKING,
  });
  ctx.y -= lineHeight(10) + 4;
  drawRule(ctx);

  const bm = c.input.brandModel.trim();
  const vin = c.input.vin.trim();
  const infoLines: string[] = [];
  if (bm) infoLines.push(`Marka / modelis: ${bm}`);
  if (vin) infoLines.push(`VIN: ${vin}`);
  if (infoLines.length) {
    for (const ln of infoLines) {
      ensureSpace(ctx, lineHeight(10));
      drawTrackedText(ctx.page, ln, {
        x: ctx.margin,
        y: ctx.y - 10,
        size: 10,
        font: ctx.font,
        color: INK,
        tracking: LETTER_TRACKING,
      });
      ctx.y -= lineHeight(10);
    }
    ctx.y -= 6;
  }

  ensureSpace(ctx, lineHeight(11) + 8);
  drawTrackedText(ctx.page, "POZĪCIJAS", {
    x: ctx.margin,
    y: ctx.y - 11,
    size: 11,
    font: ctx.fontBold,
    color: INK,
    tracking: 0.154,
  });
  ctx.y -= lineHeight(11) + 6;

  const colLabelW = ctx.contentW * 0.58;
  const colAmountRight = ctx.margin + ctx.contentW - 4;

  const headerH = lineHeight(9) + 8;
  ensureSpace(ctx, headerH + 6);
  const yHeadTop = ctx.y;
  const yHeadBottom = yHeadTop - headerH;
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yHeadBottom,
    width: ctx.contentW,
    height: headerH,
    color: TABLE_HEAD_BG,
  });
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yHeadBottom,
    width: ctx.contentW,
    height: 0.55,
    color: RULE,
  });
  drawTrackedText(ctx.page, "Apraksts", {
    x: ctx.margin + 6,
    y: yHeadTop - 9,
    size: 9,
    font: ctx.fontBold,
    color: INK,
    tracking: 0.12,
  });
  const netHdr = "EUR (neto)";
  const netHdrW = measureTrackedWidth(netHdr, ctx.fontBold, 9, 0.12);
  drawTrackedText(ctx.page, netHdr, {
    x: colAmountRight - netHdrW,
    y: yHeadTop - 9,
    size: 9,
    font: ctx.fontBold,
    color: INK,
    tracking: 0.12,
  });
  ctx.y = yHeadBottom - 6;

  const lh10 = lineHeight(10);
  const lh72 = lineHeight(7.2);

  for (const row of c.tableRows) {
    if (row.net <= 0) continue;
    const labelLines = wrapText(row.label, ctx.font, 10, colLabelW - 6);
    const subH = row.subtitle ? lh72 : 0;
    const rowH = Math.max(labelLines.length * lh10, lh10) + subH + 4;
    ensureSpace(ctx, rowH);
    const rowTopY = ctx.y;
    let ly = rowTopY;
    for (const ll of labelLines) {
      drawTrackedText(ctx.page, ll, {
        x: ctx.margin + 4,
        y: ly - 10,
        size: 10,
        font: ctx.font,
        color: INK,
        tracking: LETTER_TRACKING,
      });
      ly -= lh10;
    }
    if (row.subtitle) {
      drawTrackedText(ctx.page, row.subtitle, {
        x: ctx.margin + 4,
        y: ly - 7.2,
        size: 7.2,
        font: ctx.font,
        color: MUTED,
        tracking: 0.08,
      });
    }
    const amt = fmtMoneyEurLv(row.net);
    const amtW = measureTrackedWidth(amt, ctx.fontBold, 10, LETTER_TRACKING);
    drawTrackedText(ctx.page, amt, {
      x: colAmountRight - amtW,
      y: rowTopY - 10,
      size: 10,
      font: ctx.fontBold,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    ctx.y = rowTopY - rowH;
  }

  ctx.y -= 6;
  drawRule(ctx);

  for (const ln of wrapText(LV_PVN_TAME_LEGAL_NOTE, ctx.font, 7.8, ctx.contentW - 4)) {
    ensureSpace(ctx, lineHeight(7.8));
    drawTrackedText(ctx.page, ln, {
      x: ctx.margin + 2,
      y: ctx.y - 7.8,
      size: 7.8,
      font: ctx.font,
      color: MUTED,
      tracking: 0.06,
    });
    ctx.y -= lineHeight(7.8);
  }
  ctx.y -= 10;

  const drawSummaryLine = (label: string, value: string, bold = false) => {
    const f = bold ? ctx.fontBold : ctx.font;
    const lh = lineHeight(11);
    ensureSpace(ctx, lh + 4);
    drawTrackedText(ctx.page, label, {
      x: ctx.margin,
      y: ctx.y - 11,
      size: 11,
      font: f,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    const vw = measureTrackedWidth(value, f, 11, LETTER_TRACKING);
    drawTrackedText(ctx.page, value, {
      x: ctx.margin + ctx.contentW - vw,
      y: ctx.y - 11,
      size: 11,
      font: f,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    ctx.y -= lh + 2;
  };

  drawSummaryLine("Kopā bez PVN (neto bāze)", fmtMoneyEurLv(c.summaBezPVN));
  drawSummaryLine("PVN 21 %", fmtMoneyEurLv(c.pvnKopa));
  ctx.y -= 8;
  drawSummaryLine("GALA SUMMA APMAKSAI", fmtMoneyEurLv(c.galaSumma), true);

  const disclaimer = "Šis aprēķins ir informatīvs un nav uzskatāms par oficiālu rēķinu.";
  ctx.y -= 16;
  for (const ln of wrapText(disclaimer, ctx.font, 8.5, ctx.contentW)) {
    ensureSpace(ctx, lineHeight(8.5));
    drawTrackedText(ctx.page, ln, {
      x: ctx.margin,
      y: ctx.y - 8.5,
      size: 8.5,
      font: ctx.font,
      color: MUTED,
      tracking: 0.12,
    });
    ctx.y -= lineHeight(8.5);
  }

  return ctx.pdfDoc.save();
}

export const generateDzintarzemeTame = generateDzintarzemeTamePdfBytes;
