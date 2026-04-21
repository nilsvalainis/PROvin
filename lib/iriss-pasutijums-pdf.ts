import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";

import { IRISS_COMPANY_LINES } from "@/lib/iriss-brand";
import type { IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { shrinkImageBytesForIrissPdf } from "@/lib/shrink-image-for-iriss-pdf";

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

/** PROVIN audit blue */
const AUDIT_ACCENT = rgb(0 / 255, 97 / 255, 210 / 255);
const INK = rgb(29 / 255, 29 / 255, 31 / 255);
const MUTED = rgb(110 / 255, 110 / 255, 115 / 255);
const AUDIT_CARD_FILL = rgb(1, 1, 1);
const AUDIT_CARD_BORDER = rgb(226 / 255, 232 / 255, 240 / 255);
/** Papildu atstarpe starp etiķetes beigām un vērtību vienas rindas layoutā (PDF vienības). */
const COLON_VALUE_GAP = 3;
/** Piedāvājuma kopsummas josla — saskaņā ar `IRISS_BRAND_ORANGE_HEX` (#F26522). */
const PRICE_BAND_FILL = rgb(255 / 255, 248 / 255, 245 / 255);
const PRICE_BAND_BORDER = rgb(242 / 255, 101 / 255, 34 / 255);
const SECTION_BEFORE = 14;
const SECTION_AFTER = 10;
const LETTER_TRACKING = 0.22;
const FOOTER_SAFE = 52;
/** Atkārtotai lapai — tikai logo josla no lapas augšas. */
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

type LogoPack = { img: PDFImage; dw: number; dh: number };
type PdfColor = ReturnType<typeof rgb>;
type CardTheme = {
  fill: PdfColor;
  border: PdfColor;
  borderWidth: number;
  titleColor: PdfColor;
  titleUppercase: boolean;
  titleSize: number;
  titleGapAfter: number;
  headBarColor: PdfColor | null;
};

const PROVIN_AUDIT_PDF_CARD_THEME: CardTheme = {
  fill: AUDIT_CARD_FILL,
  border: AUDIT_CARD_BORDER,
  borderWidth: 1.25,
  titleColor: INK,
  titleUppercase: true,
  titleSize: 11,
  titleGapAfter: 5,
  headBarColor: AUDIT_ACCENT,
};

type Ctx = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  margin: number;
  contentW: number;
  pageW: number;
  pageH: number;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  /** Ja true, `ensureSpace` neveic lapu pārtraukumu (izmanto zīmēšanai iekš kartītes pēc augstuma pārbaudes). */
  suppressPageBreak: boolean;
  /** Piedāvājuma PDF — logo katrā lapā; null = nav. */
  offerLogo: LogoPack | null;
  /** Jauna lapa: atstarpe zem augšējā logo (saturs sākas zem šīs joslas). */
  logoOnlyBand: number;
  cardTheme: CardTheme;
};

function stampOfferLogoTopLeft(page: PDFPage, pageH: number, margin: number, logo: LogoPack): void {
  const pad = 3;
  const w = logo.dw + pad * 2;
  const h = logo.dh + pad * 2;
  const yRect = pageH - margin - h;
  page.drawRectangle({ x: margin, y: yRect, width: w, height: h, color: rgb(1, 1, 1) });
  page.drawImage(logo.img, {
    x: margin + pad,
    y: yRect + pad,
    width: logo.dw,
    height: logo.dh,
  });
}

function ensureSpace(ctx: Ctx, need: number): void {
  if (ctx.suppressPageBreak) return;
  if (ctx.y - need < ctx.margin + FOOTER_SAFE) {
    ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
    if (ctx.offerLogo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, ctx.offerLogo);
    ctx.y = ctx.pageH - ctx.margin - (ctx.offerLogo ? ctx.logoOnlyBand : 0);
  }
}

type TextLayout = { x?: number; maxW?: number };

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

function drawTextLine(
  ctx: Ctx,
  text: string,
  size: number,
  opts?: { font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number },
) {
  const f = opts?.font ?? ctx.font;
  const c = opts?.color ?? INK;
  const x = opts?.x ?? ctx.margin;
  ensureSpace(ctx, lineHeight(size));
  drawTrackedText(ctx.page, text, { x, y: ctx.y - size, size, font: f, color: c });
  ctx.y -= lineHeight(size);
}

function drawParagraph(ctx: Ctx, text: string, size: number, color = INK, f?: PDFFont, layout?: TextLayout) {
  const font = f ?? ctx.font;
  const x = layout?.x ?? ctx.margin;
  const maxW = layout?.maxW ?? ctx.contentW;
  for (const ln of wrapText(text, font, size, maxW)) {
    drawTextLine(ctx, ln, size, { font, color, x });
  }
}

function measureWrappedBlockHeight(text: string, font: PDFFont, size: number, maxW: number): number {
  const lines = wrapText(text, font, size, maxW);
  return lines.length * lineHeight(size);
}

function measureLinesHeight(lines: string[], font: PDFFont, size: number, maxW: number): number {
  let h = 0;
  for (const ln of lines) {
    h += measureWrappedBlockHeight(ln, font, size, maxW);
  }
  return h;
}

/** Pēc kolona liek vienu atstarpi pirms vērtības; neskar `https://` utml. */
function normalizeInterLabelColonSpacing(line: string): string {
  return line.replace(/:(?!\s|\/\/)([^\s])/g, ": $1");
}

function splitColonLabelValue(line: string): { kind: "kv"; label: string; value: string } | { kind: "plain"; text: string } {
  const normalized = normalizeInterLabelColonSpacing(line);
  const idx = normalized.indexOf(":");
  if (idx <= 0) return { kind: "plain", text: normalized };
  return { kind: "kv", label: normalized.slice(0, idx + 1).trim(), value: normalized.slice(idx + 1).trim() };
}

function measureColonLabeledLineHeight(line: string, size: number, maxW: number, ctx: Ctx): number {
  const p = splitColonLabelValue(line);
  const lh = lineHeight(size);
  if (p.kind === "plain") return measureWrappedBlockHeight(p.text, ctx.font, size, maxW);
  const labWithSp = `${p.label} `;
  const lw = measureTrackedWidth(labWithSp, ctx.fontBold, size);
  if (!p.value) return lh;
  const restFirst = maxW - lw - COLON_VALUE_GAP;
  if (restFirst < 36) return lh + measureWrappedBlockHeight(p.value, ctx.font, size, maxW);
  if (measureTrackedWidth(p.value, ctx.font, size) <= restFirst && !p.value.includes("\n")) return lh;
  return lh + measureWrappedBlockHeight(p.value, ctx.font, size, maxW);
}

function measureColonLabeledLinesHeight(lines: string[], size: number, maxW: number, ctx: Ctx): number {
  let h = 0;
  for (const ln of lines) h += measureColonLabeledLineHeight(ln, size, maxW, ctx);
  return h;
}

function drawColonLabeledLine(ctx: Ctx, line: string, size: number, x: number, maxW: number, color = INK) {
  const p = splitColonLabelValue(line);
  const lh = lineHeight(size);
  if (p.kind === "plain") {
    for (const ln of wrapText(p.text, ctx.font, size, maxW)) {
      drawTrackedText(ctx.page, ln, { x, y: ctx.y - size, size, font: ctx.font, color });
      ctx.y -= lh;
    }
    return;
  }
  const labWithSp = `${p.label} `;
  const lw = measureTrackedWidth(labWithSp, ctx.fontBold, size);
  const restFirst = maxW - lw - COLON_VALUE_GAP;
  const yb = ctx.y - size;
  if (!p.value) {
    drawTrackedText(ctx.page, p.label, { x, y: yb, size, font: ctx.fontBold, color });
    ctx.y -= lh;
    return;
  }
  if (restFirst >= 36 && measureTrackedWidth(p.value, ctx.font, size) <= restFirst && !p.value.includes("\n")) {
    drawTrackedText(ctx.page, labWithSp, { x, y: yb, size, font: ctx.fontBold, color });
    drawTrackedText(ctx.page, p.value, { x: x + lw + COLON_VALUE_GAP, y: yb, size, font: ctx.font, color });
    ctx.y -= lh;
    return;
  }
  drawTrackedText(ctx.page, p.label, { x, y: yb, size, font: ctx.fontBold, color });
  ctx.y -= lh;
  for (const ln of wrapText(p.value, ctx.font, size, maxW)) {
    drawTrackedText(ctx.page, ln, { x, y: ctx.y - size, size, font: ctx.font, color });
    ctx.y -= lh;
  }
}

/**
 * Vieglas kartītes fons + apmale (zīmēts pirms teksta), admin iOS stilam līdzīgi.
 * Kartīte nekad netiek pārrauta starp lapām — pirms zīmēšanas tiek rezervēta pilna augstuma vieta.
 */
function drawIosCard(
  ctx: Ctx,
  title: string,
  measureBody: (innerW: number) => number,
  drawBody: (inner: { x: number; w: number }) => void,
): void {
  const t = ctx.cardTheme;
  const pad = 10;
  const radius = 8;
  const ix = ctx.margin + pad;
  const iw = ctx.contentW - pad * 2;
  const titleBlock = lineHeight(t.titleSize) + t.titleGapAfter;
  const bodyH = measureBody(iw);
  const h = pad + titleBlock + bodyH + pad;
  const outerNeed = SECTION_BEFORE + h + SECTION_AFTER;

  if (!ctx.suppressPageBreak && ctx.y - outerNeed < ctx.margin + FOOTER_SAFE) {
    ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
    if (ctx.offerLogo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, ctx.offerLogo);
    ctx.y = ctx.pageH - ctx.margin - (ctx.offerLogo ? ctx.logoOnlyBand : 0);
  }

  ctx.y -= SECTION_BEFORE;
  const yTopCard = ctx.y;
  const yRectBottom = yTopCard - h;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: yRectBottom,
    width: ctx.contentW,
    height: h,
    radius,
    color: t.fill,
    borderColor: t.border,
    borderWidth: t.borderWidth,
  });
  ctx.y = yRectBottom + h - pad;
  const prev = ctx.suppressPageBreak;
  ctx.suppressPageBreak = true;
  try {
    if (t.headBarColor) {
      const barH = lineHeight(t.titleSize) + 2;
      ctx.page.drawRectangle({
        x: ix - 8,
        y: ctx.y - barH + 2,
        width: 2,
        height: barH,
        color: t.headBarColor,
      });
    }
    const titleText = t.titleUppercase ? title.toLocaleUpperCase("lv-LV") : title;
    drawTextLine(ctx, titleText, t.titleSize, { font: ctx.fontBold, color: t.titleColor, x: ix });
    ctx.y -= t.titleGapAfter;
    drawBody({ x: ix, w: iw });
  } finally {
    ctx.suppressPageBreak = prev;
  }
  ctx.y = yRectBottom - SECTION_AFTER;
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

/** Tukši lauki PDF netiek iekļauti. */
function val(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

function parseMoney(value: string | undefined): number {
  const compact = (value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? n : 0;
}

const MAX_IMAGE_DATAURL_BASE64_CHARS = 1_800_000;
const MAX_RAW_IMAGE_BYTES = 1_200_000;

function tryParseImageDataUrlToBuffer(dataUrl: string): Buffer | null {
  const compact = dataUrl.replace(/\s/g, "");
  const m = /^data:image\/[a-z0-9+.-]+;base64,([\s\S]+)$/i.exec(compact);
  if (!m) return null;
  const b64 = m[1];
  if (b64.length > MAX_IMAGE_DATAURL_BASE64_CHARS) return null;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

type EmbeddedPic = { img: PDFImage; w: number; h: number };

async function tryEmbedOfferImage(pdfDoc: PDFDocument, dataUrl: string): Promise<EmbeddedPic | null> {
  const raw = tryParseImageDataUrlToBuffer(dataUrl);
  if (!raw || raw.byteLength > MAX_RAW_IMAGE_BYTES) return null;
  const shrunk = await shrinkImageBytesForIrissPdf(raw);
  if (!shrunk) return null;
  try {
    const img = await pdfDoc.embedJpg(shrunk);
    return { img, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

function drawImageRow2Col(
  ctx: Ctx,
  left: EmbeddedPic,
  right: EmbeddedPic | null,
  cellW: number,
  colGap: number,
  maxCellH: number,
  originX = ctx.margin,
) {
  const sL = Math.min(cellW / left.w, maxCellH / left.h, 1);
  const dwL = left.w * sL;
  const dhL = left.h * sL;
  let dwR = 0;
  let dhR = 0;
  if (right) {
    const sR = Math.min(cellW / right.w, maxCellH / right.h, 1);
    dwR = right.w * sR;
    dhR = right.h * sR;
  }
  const rowH = Math.max(dhL, dhR);
  if (!ctx.suppressPageBreak) ensureSpace(ctx, rowH + 14);
  const topY = ctx.y;
  ctx.page.drawImage(left.img, {
    x: originX + (cellW - dwL) / 2,
    y: topY - dhL,
    width: dwL,
    height: dhL,
  });
  if (right) {
    ctx.page.drawImage(right.img, {
      x: originX + cellW + colGap + (cellW - dwR) / 2,
      y: topY - dhR,
      width: dwR,
      height: dhR,
    });
  }
  ctx.y -= rowH + 14;
}

async function createPdfCtx(): Promise<Ctx> {
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
    suppressPageBreak: false,
    offerLogo: null,
    logoOnlyBand: LOGO_ONLY_BAND,
    cardTheme: { ...PROVIN_AUDIT_PDF_CARD_THEME },
  };
}

function drawFooter(ctx: Ctx) {
  ctx.y -= 10;
  for (const line of IRISS_COMPANY_LINES) {
    drawParagraph(ctx, line, 8, MUTED);
  }
}

function fmtMoneyEurLv(total: number): string {
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(total);
}

function drawKopaHighlightBand(ctx: Ctx, boxX: number, boxW: number, totalPrice: number): void {
  const label = "Kopā";
  const amountStr = fmtMoneyEurLv(totalPrice);
  const h = 52;
  ctx.y -= 8;
  const yTop = ctx.y;
  const yBottom = yTop - h;
  drawRoundedRect(ctx.page, {
    x: boxX,
    y: yBottom,
    width: boxW,
    height: h,
    radius: 10,
    color: PRICE_BAND_FILL,
    borderColor: PRICE_BAND_BORDER,
    borderWidth: 1.25,
  });
  const baseline = yBottom + 18;
  drawTrackedText(ctx.page, label, {
    x: boxX + 14,
    y: baseline,
    size: 13,
    font: ctx.fontBold,
    color: INK,
    tracking: LETTER_TRACKING,
  });
  const fs = 19;
  const amtW = measureTrackedWidth(amountStr, ctx.font, fs, LETTER_TRACKING);
  drawTrackedText(ctx.page, amountStr, {
    x: boxX + boxW - 14 - amtW,
    y: baseline - 1,
    size: fs,
    font: ctx.font,
    color: INK,
    tracking: LETTER_TRACKING,
  });
  ctx.y = yBottom - 10;
}

async function loadOfferLogoPack(pdfDoc: PDFDocument): Promise<LogoPack | null> {
  try {
    const sourceBuf = await fs.readFile(DZINTARZEME_OFFER_LOGO_PATH);
    const { data, info } = await sharp(sourceBuf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Padara gandrīz melnu fonu caurspīdīgu, lai PDF vienmēr izskatās uz balta fona.
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (r < 38 && g < 38 && b < 38) {
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
    const maxW = 56;
    const maxH = 36;
    const s = Math.min(maxW / img.width, maxH / img.height, 1);
    return { img, dw: img.width * s, dh: img.height * s };
  } catch {
    return null;
  }
}

async function drawOfferPdfHero(ctx: Ctx, offer: IrissOfferRecord): Promise<void> {
  const heroTitle = val(offer.brandModel) ?? val(offer.title) ?? "Piedāvājums";
  const logo = ctx.offerLogo;
  const lh20 = lineHeight(20);
  const logoBoxW = logo ? logo.dw + 6 : 0;
  const titleColX = ctx.margin + (logo ? logoBoxW + 14 : 0);
  const titleColW = ctx.contentW - (logo ? logoBoxW + 14 : 0);
  const titleLines = wrapText(heroTitle, ctx.font, 20, titleColW);
  const titleH = titleLines.length * lh20;
  const rowH = Math.max(logo ? logo.dh + 6 : 0, titleH);

  ensureSpace(ctx, rowH + lineHeight(11) + 22);
  const rowTopY = ctx.y;

  if (logo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, logo);

  let ty = rowTopY;
  for (const line of titleLines) {
    drawTrackedText(ctx.page, line, {
      x: titleColX,
      y: ty - 20,
      size: 20,
      font: ctx.font,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    ty -= lh20;
  }

  const logoBandBottom = logo ? ctx.pageH - ctx.margin - (logo.dh + 6) : rowTopY;
  const titleBlockBottom = rowTopY - titleLines.length * lh20;
  ctx.y = Math.min(logoBandBottom, titleBlockBottom) - 8;
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 10, MUTED, undefined, {
    x: ctx.margin,
    maxW: ctx.contentW,
  });
  ctx.y -= 10;
}

export async function buildIrissPasutijumsPdfBytes(record: IrissPasutijumsRecord): Promise<Uint8Array> {
  const ctx = await createPdfCtx();

  drawTextLine(ctx, "PASŪTĪJUMS", 19, { font: ctx.fontBold, color: INK });
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 10, MUTED, undefined, {
    x: ctx.margin,
    maxW: ctx.contentW,
  });
  ctx.y -= 10;

  const clientLines: string[] = [];
  const vFn = val(record.clientFirstName);
  const vLn = val(record.clientLastName);
  if (vFn) clientLines.push(`Vārds: ${vFn}`);
  if (vLn) clientLines.push(`Uzvārds: ${vLn}`);
  const vPh = val(record.phone);
  if (vPh) clientLines.push(`Tālrunis: ${vPh}`);
  const vEm = val(record.email);
  if (vEm) clientLines.push(`E-pasts: ${vEm}`);
  const vOd = val(record.orderDate);
  if (vOd) clientLines.push(`Pasūtījuma datums: ${vOd}`);
  if (clientLines.length) {
    drawIosCard(
      ctx,
      "Klienta dati",
      (iw) => measureColonLabeledLinesHeight(clientLines, 10, iw, ctx),
      ({ x, w }) => {
        for (const ln of clientLines) drawColonLabeledLine(ctx, ln, 10, x, w);
      },
    );
  }

  const vehLines: string[] = [];
  const pushV = (label: string, s: string | undefined) => {
    const v = val(s);
    if (v) vehLines.push(`${label}: ${v}`);
  };
  pushV("Marka / modelis", record.brandModel);
  pushV("Ražošanas gadi", record.productionYears);
  pushV("Kopējais budžets", record.totalBudget);
  pushV("Dzinēja tips", record.engineType);
  pushV("Ātrumkārba", record.transmission);
  pushV("Maks. nobraukums", record.maxMileage);
  pushV("Vēlamās krāsas", record.preferredColors);
  pushV("Nevēlamās krāsas", record.nonPreferredColors);
  pushV("Salona apdare", record.interiorFinish);
  if (vehLines.length) {
    drawIosCard(
      ctx,
      "Transportlīdzekļa specifikācija",
      (iw) => measureColonLabeledLinesHeight(vehLines, 10, iw, ctx),
      ({ x, w }) => {
        for (const ln of vehLines) drawColonLabeledLine(ctx, ln, 10, x, w);
      },
    );
  }

  const req = val(record.equipmentRequired);
  if (req) {
    drawIosCard(
      ctx,
      "Obligātās prasības (aprīkojums)",
      (iw) => measureWrappedBlockHeight(req, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, req, 10, INK, ctx.font, { x, maxW: w }),
    );
  }
  const des = val(record.equipmentDesired);
  if (des) {
    drawIosCard(
      ctx,
      "Vēlamās prasības (aprīkojums)",
      (iw) => measureWrappedBlockHeight(des, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, des, 10, INK, ctx.font, { x, maxW: w }),
    );
  }

  const n = val(record.notes);
  if (n) {
    drawIosCard(
      ctx,
      "Piezīmes",
      (iw) => measureWrappedBlockHeight(n, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, n, 10, INK, ctx.font, { x, maxW: w }),
    );
  }

  const links: string[] = [];
  const pushL = (label: string, s: string | undefined) => {
    const t = val(s);
    if (t) links.push(`${label}: ${t}`);
  };
  pushL("Mobile", record.listingLinkMobile);
  pushL("Autobid", record.listingLinkAutobid);
  pushL("Openline", record.listingLinkOpenline);
  pushL("Auto1", record.listingLinkAuto1);
  for (let i = 0; i < record.listingLinksOther.length; i++) {
    const t = val(record.listingLinksOther[i]);
    if (t) links.push(`Cits ${i + 1}: ${t}`);
  }
  if (links.length) {
    drawIosCard(
      ctx,
      "Sludinājumu saites",
      (iw) => measureColonLabeledLinesHeight(links, 9, iw, ctx),
      ({ x, w }) => {
        for (const ln of links) drawColonLabeledLine(ctx, ln, 9, x, w);
      },
    );
  }

  drawFooter(ctx);
  return ctx.pdfDoc.save();
}

export type BuildIrissOfferPdfOptions = {
  embedImages?: boolean;
  includeClientData?: boolean;
};

export async function buildIrissOfferPdfBytes(
  record: IrissPasutijumsRecord,
  offer: IrissOfferRecord,
  opts?: BuildIrissOfferPdfOptions,
): Promise<Uint8Array> {
  const embedImages = opts?.embedImages !== false;
  const includeClientData = opts?.includeClientData !== false;
  const ctx = await createPdfCtx();
  ctx.offerLogo = await loadOfferLogoPack(ctx.pdfDoc);
  ctx.logoOnlyBand = ctx.offerLogo ? Math.max(LOGO_ONLY_BAND, Math.ceil(ctx.offerLogo.dh + 20)) : LOGO_ONLY_BAND;

  await drawOfferPdfHero(ctx, offer);

  const clientLines: string[] = [];
  const name = `${record.clientFirstName} ${record.clientLastName}`.trim();
  if (name) clientLines.push(`Klients: ${name}`);
  const ph = val(record.phone);
  if (ph) clientLines.push(`Tālrunis: ${ph}`);
  const em = val(record.email);
  if (em) clientLines.push(`E-pasts: ${em}`);
  if (includeClientData && clientLines.length) {
    drawIosCard(
      ctx,
      "Klienta dati",
      (iw) => measureColonLabeledLinesHeight(clientLines, 10, iw, ctx),
      ({ x, w }) => {
        for (const ln of clientLines) drawColonLabeledLine(ctx, ln, 10, x, w);
      },
    );
  }

  const offerLines: string[] = [];
  const firstRegistration = val(offer.firstRegistration) ?? val(offer.year);
  const odometer = val(offer.odometerReading) ?? val(offer.mileage);
  if (val(offer.brandModel)) offerLines.push(`Marka, modelis: ${val(offer.brandModel)}`);
  if (firstRegistration) offerLines.push(`Pirmā reģistrācija: ${firstRegistration}`);
  if (odometer) offerLines.push(`Odometra rādījums: ${odometer}`);
  if (val(offer.transmission)) offerLines.push(`Transmisija: ${val(offer.transmission)}`);
  if (val(offer.location)) offerLines.push(`Atrašanās vieta: ${val(offer.location)}`);
  if (offerLines.length) {
    drawIosCard(
      ctx,
      "Pamatinformācija",
      (iw) => measureColonLabeledLinesHeight(offerLines, 10, iw, ctx),
      ({ x, w }) => {
        for (const ln of offerLines) drawColonLabeledLine(ctx, ln, 10, x, w);
      },
    );
  }

  const assessmentChecks: string[] = [];
  if (offer.hasFullServiceHistory) assessmentChecks.push("\u2713 Pilna servisa vēsture");
  if (offer.hasFactoryPaint) assessmentChecks.push("\u2713 Rūpnīcas krāsojums");
  if (offer.hasNoRustBody) assessmentChecks.push("\u2713 Virsbūve bez rūsas");
  if (offer.hasSecondWheelSet) assessmentChecks.push("\u2713 Otrs riteņu komplekts");
  const specialNotes = val(offer.specialNotes);
  const visual = val(offer.visualAssessment);
  const technical = val(offer.technicalAssessment);
  const summary = val(offer.summary);
  const partGap = 6;

  if (assessmentChecks.length > 0 || specialNotes || visual || technical || summary) {
    drawIosCard(ctx, "Vispārējais novērtējums", (iw) => {
      let h = 0;
      if (assessmentChecks.length) {
        h += measureLinesHeight(assessmentChecks, ctx.font, 10, iw);
      }
      if (specialNotes) {
        if (h > 0) h += partGap;
        h += measureWrappedBlockHeight("Īpašas atzīmes:", ctx.fontBold, 10, iw);
        h += measureWrappedBlockHeight(specialNotes, ctx.font, 10, iw);
      }
      if (visual) {
        if (h > 0) h += partGap;
        h += measureWrappedBlockHeight("Vizuālais novērtējums:", ctx.fontBold, 10, iw);
        h += measureWrappedBlockHeight(visual, ctx.font, 10, iw);
      }
      if (technical) {
        if (h > 0) h += partGap;
        h += measureWrappedBlockHeight("Tehniskais novērtējums:", ctx.fontBold, 10, iw);
        h += measureWrappedBlockHeight(technical, ctx.font, 10, iw);
      }
      if (summary) {
        if (h > 0) h += partGap;
        h += measureWrappedBlockHeight("Kopsavilkums:", ctx.fontBold, 10, iw);
        h += measureWrappedBlockHeight(summary, ctx.font, 10, iw);
      }
      return h;
    }, ({ x, w }) => {
      let filled = false;
      for (const ln of assessmentChecks) {
        drawParagraph(ctx, ln, 10, INK, ctx.fontBold, { x, maxW: w });
        filled = true;
      }
      if (specialNotes) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Īpašas atzīmes:", 10, INK, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, specialNotes, 10, INK, ctx.font, { x, maxW: w });
        filled = true;
      }
      if (visual) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Vizuālais novērtējums:", 10, INK, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, visual, 10, INK, ctx.font, { x, maxW: w });
        filled = true;
      }
      if (technical) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Tehniskais novērtējums:", 10, INK, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, technical, 10, INK, ctx.font, { x, maxW: w });
        filled = true;
      }
      if (summary) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Kopsavilkums:", 10, INK, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, summary, 10, INK, ctx.font, { x, maxW: w });
      }
    });
  }

  const carPrice = val(offer.carPrice) ?? val(offer.priceGermany);
  const deliveryPrice = val(offer.deliveryPrice);
  const commissionFee = val(offer.commissionFee);
  const totalPrice = parseMoney(carPrice ?? "") + parseMoney(deliveryPrice ?? "") + parseMoney(commissionFee ?? "");
  const offerValidDays = val(offer.offerValidDays);
  const pricingPlainLines: string[] = [];
  if (carPrice) pricingPlainLines.push(`Automašīnas cena: ${carPrice}`);
  if (deliveryPrice) pricingPlainLines.push(`Piegādes cena: ${deliveryPrice}`);
  if (commissionFee) pricingPlainLines.push(`Komisijas maksa: ${commissionFee}`);
  const hasPricing = pricingPlainLines.length > 0 || totalPrice > 0;

  if (hasPricing) {
    drawIosCard(ctx, "Cenas un piedāvājums", (iw) => {
      let h = measureColonLabeledLinesHeight(pricingPlainLines, 10, iw, ctx);
      if (totalPrice > 0) {
        if (h > 0) h += 8;
        h += 52 + 10;
      }
      return h;
    }, ({ x, w }) => {
      for (const ln of pricingPlainLines) {
        drawColonLabeledLine(ctx, ln, 10, x, w);
      }
      if (totalPrice > 0) {
        if (pricingPlainLines.length > 0) ctx.y -= 6;
        drawKopaHighlightBand(ctx, x, w, totalPrice);
      }
    });
  }

  const imageAttachments = offer.attachments.filter(
    (a) => a.mimeType.startsWith("image/") && a.dataUrl.startsWith("data:image/"),
  );
  const other = offer.attachments.filter((a) => !imageAttachments.includes(a));

  if (!embedImages && imageAttachments.length > 0) {
    drawIosCard(
      ctx,
      "Pievienotie attēli",
      (iw) =>
        measureWrappedBlockHeight("Attēli šajā eksportā nav iekļauti (ātrs PDF bez attēliem).", ctx.font, 9, iw),
      ({ x, w }) => {
        drawParagraph(ctx, "Attēli šajā eksportā nav iekļauti (ātrs PDF bez attēliem).", 9, MUTED, undefined, {
          x,
          maxW: w,
        });
      },
    );
  } else if (embedImages && imageAttachments.length > 0) {
    const pics: EmbeddedPic[] = [];
    for (const att of imageAttachments) {
      const emb = await tryEmbedOfferImage(ctx.pdfDoc, att.dataUrl);
      if (emb) pics.push(emb);
    }
    if (pics.length > 0) {
      const COL_GAP = 12;
      const MAX_CELL_H = 178;
      const rowPixel = MAX_CELL_H + 14;
      const titleBlock = lineHeight(ctx.cardTheme.titleSize) + ctx.cardTheme.titleGapAfter;
      const cardVerticalChrome = 20 + titleBlock;
      let picIdx = 0;
      while (picIdx < pics.length) {
        const maxBodyH =
          ctx.y -
          ctx.margin -
          FOOTER_SAFE -
          SECTION_BEFORE -
          SECTION_AFTER -
          cardVerticalChrome;
        let maxRows = Math.floor(maxBodyH / rowPixel);
        if (maxRows < 1) maxRows = 1;
        const maxPhotosThisCard = maxRows * 2;
        const remaining = pics.length - picIdx;
        const countThisCard = Math.min(remaining, maxPhotosThisCard);
        const chunk = pics.slice(picIdx, picIdx + countThisCard);
        picIdx += countThisCard;
        const rowsThis = Math.ceil(chunk.length / 2);
        drawIosCard(
          ctx,
          "Fotogrāfijas",
          () => rowsThis * rowPixel,
          ({ x, w }) => {
            const cw = (w - COL_GAP) / 2;
            for (let j = 0; j < chunk.length; j += 2) {
              drawImageRow2Col(ctx, chunk[j]!, chunk[j + 1] ?? null, cw, COL_GAP, MAX_CELL_H, x);
            }
          },
        );
      }
    }
  }

  if (other.length > 0) {
    const lines = other.map((a, i) => `${i + 1}. ${a.name}`);
    drawIosCard(
      ctx,
      "Fotogrāfiju pielikumi",
      (iw) => measureLinesHeight(lines, ctx.font, 9, iw),
      ({ x, w }) => {
        for (const ln of lines) drawParagraph(ctx, ln, 9, INK, ctx.font, { x, maxW: w });
      },
    );
  }

  if (offerValidDays) {
    ensureSpace(ctx, lineHeight(11) + 20);
    drawParagraph(ctx, `Piedāvājums spēkā (dienas): ${offerValidDays}`, 10, INK, ctx.fontBold, {
      x: ctx.margin,
      maxW: ctx.contentW,
    });
    ctx.y -= 8;
  }

  drawFooter(ctx);
  return ctx.pdfDoc.save();
}
