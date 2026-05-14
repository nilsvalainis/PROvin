import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";

import { DZ_PASUTIJUMS_TERMS_BLOCKS } from "@/lib/dzintarzeme-pasutijums-terms-content";
import {
  drawDzintarzemePdfFooter,
  drawFittedOneLine,
  drawSectionCardWithShadow,
  drawSectionHeadInCard,
  drawTrackedText as dzDrawTrackedText,
  FOOTER_BLOCK_H as DZ_FOOTER_BLOCK_H,
  INK as DZ_INK,
  lineHeight as dzLineHeight,
  loadOfferLogoPack as dzLoadOfferLogoPack,
  MUTED as DZ_MUTED,
  SEC_CARD_FILL as DZ_SEC_CARD_FILL,
  SEC_HEAD as DZ_SEC_HEAD,
  SECTION_GAP as DZ_SECTION_GAP,
  wrapText as dzWrapText,
} from "@/lib/dzintarzeme-pdf-layout";
import { getIrissPdfSupplierFooterLines, IRISS_BRAND_ORANGE_HEX } from "@/lib/iriss-brand";
import { IRISS_DEAL_DETAIL_OPTIONS, type IrissOfferRecord, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { internalCommentHtmlToPdfPlain } from "@/lib/admin-internal-comment-pdf";
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

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** IRISS logo / HTML PDF akcents (#F26522). */
const IRISS_ACCENT = hexToRgb(IRISS_BRAND_ORANGE_HEX);
/** Virsraksti/pamatteksts — gandrīz melns. */
const INK = rgb(17 / 255, 24 / 255, 39 / 255);
/** Sekundārais teksts — joprojām ļoti tumšs. */
const MUTED = rgb(31 / 255, 41 / 255, 55 / 255);
const CARD_FILL_SLATE = rgb(248 / 255, 250 / 255, 252 / 255);
const CARD_BORDER_SLATE = rgb(15 / 255, 23 / 255, 42 / 255);
const BAR_TRACK = rgb(226 / 255, 232 / 255, 240 / 255);
const RULE_DARK = rgb(15 / 255, 23 / 255, 42 / 255);
/** Papildu atstarpe starp etiķetes beigām un vērtību vienas rindas layoutā (PDF vienības). */
const COLON_VALUE_GAP = 3;
/** Piedāvājuma kopsummas josla — saskaņā ar `IRISS_BRAND_ORANGE_HEX` (#F26522). */
const PRICE_BAND_FILL = rgb(255 / 255, 248 / 255, 245 / 255);
const PRICE_BAND_BORDER = rgb(242 / 255, 101 / 255, 34 / 255);
const SECTION_BEFORE = 14;
const SECTION_AFTER = 10;
const LETTER_TRACKING = 0.242;
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

const IRISS_PDF_CARD_THEME: CardTheme = {
  fill: CARD_FILL_SLATE,
  border: CARD_BORDER_SLATE,
  borderWidth: 1.2,
  titleColor: INK,
  titleUppercase: true,
  titleSize: 11,
  titleGapAfter: 8,
  headBarColor: null,
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
  /** Pasūtījuma PDF 1. lapa: neveidot jaunu lapu (viss uz vienas A4). */
  pasutijumsDzLockPage1?: boolean;
  /** Piedāvājuma PDF — logo katrā lapā; null = nav. */
  offerLogo: LogoPack | null;
  /** Jauna lapa: atstarpe zem augšējā logo (saturs sākas zem šīs joslas). */
  logoOnlyBand: number;
  cardTheme: CardTheme;
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

function ensureSpace(ctx: Ctx, need: number): void {
  if (ctx.suppressPageBreak) return;
  if (ctx.pasutijumsDzLockPage1) return;
  if (ctx.y - need < ctx.margin + FOOTER_SAFE) {
    ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
    if (ctx.offerLogo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, ctx.offerLogo);
    ctx.y = ctx.pageH - ctx.margin - (ctx.offerLogo ? ctx.logoOnlyBand : 0);
  }
}

/** Ja pašreizējā lapā nepietiek vietas veselam blokam, sāk jaunu lapu (kartītes netiek grieztas). */
function ensureRoomForBlock(ctx: Ctx, outerNeed: number): void {
  if (ctx.suppressPageBreak) return;
  if (ctx.pasutijumsDzLockPage1) return;
  if (ctx.y - outerNeed < ctx.margin + FOOTER_SAFE) {
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
  const f = opts?.font ?? ctx.fontBold;
  const c = opts?.color ?? INK;
  const x = opts?.x ?? ctx.margin;
  ensureSpace(ctx, lineHeight(size));
  drawTrackedText(ctx.page, text, { x, y: ctx.y - size, size, font: f, color: c });
  ctx.y -= lineHeight(size);
}

function drawParagraph(ctx: Ctx, text: string, size: number, color = INK, f?: PDFFont, layout?: TextLayout) {
  const font = f ?? ctx.fontBold;
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
  const withGap = line.replace(/:(?!\s)(?!\/\/)([^\s])/g, ": $1");
  return withGap.replace(/: +/g, ": ");
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
  /* Garas etiķetes: vērtība nākamajā rindā — pirmā rinda beidzas ar „: ”, lai nav „:Jā”. */
  drawTrackedText(ctx.page, labWithSp, { x, y: yb, size, font: ctx.fontBold, color });
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
  opts?: { omitFrame?: boolean },
): void {
  const t = ctx.cardTheme;
  const pad = 10;
  const radius = 10;
  const titleBarH = lineHeight(t.titleSize) + 8;
  const titleGapToFrame = 6;
  const ix = ctx.margin + pad;
  const iw = ctx.contentW - pad * 2;
  const bodyH = measureBody(iw);
  const frameH = pad + bodyH + pad;
  const h = titleBarH + titleGapToFrame + frameH;
  const outerNeed = SECTION_BEFORE + h + SECTION_AFTER;
  ensureRoomForBlock(ctx, outerNeed);

  const omitFrame = opts?.omitFrame === true;
  ctx.y -= SECTION_BEFORE;
  const yTopCard = ctx.y;
  const yTitleBottom = yTopCard - titleBarH;
  const yRectBottom = yTitleBottom - titleGapToFrame - frameH;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: yTitleBottom,
    width: ctx.contentW,
    height: titleBarH,
    radius: 7,
    color: rgb(233 / 255, 237 / 255, 243 / 255),
  });
  ctx.page.drawRectangle({
    x: ctx.margin + 2,
    y: yTitleBottom + 2,
    width: 2,
    height: Math.max(2, titleBarH - 4),
    color: IRISS_ACCENT,
  });
  if (!omitFrame) {
    drawRoundedRect(ctx.page, {
      x: ctx.margin,
      y: yRectBottom,
      width: ctx.contentW,
      height: frameH,
      radius,
      color: t.fill,
      borderColor: t.border,
      borderWidth: t.borderWidth,
    });
  }
  const titleText = t.titleUppercase ? title.toLocaleUpperCase("lv-LV") : title;
  drawTrackedText(ctx.page, titleText, {
    x: ix,
    y: yTopCard - t.titleSize - 4,
    size: t.titleSize,
    font: ctx.fontBold,
    color: INK,
    tracking: LETTER_TRACKING,
  });
  ctx.y = yRectBottom + frameH - pad;
  const prev = ctx.suppressPageBreak;
  ctx.suppressPageBreak = true;
  try {
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

const BAR_H = 7;

function parseScoreOutOf10(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m1 = t.match(/\b(\d{1,2})\s*\/\s*10\b/i);
  if (m1) {
    const n = Number.parseInt(m1[1], 10);
    if (n >= 0 && n <= 10) return n;
  }
  const m2 = t.match(/\b(\d{1,2})\s+no\s+10\b/i);
  if (m2) {
    const n = Number.parseInt(m2[1], 10);
    if (n >= 0 && n <= 10) return n;
  }
  return null;
}

/** Veselības josla tikai tad, ja tekstā ir skaitlis „X/10” vai „X no 10”. */
function measureHealthBarOnly(bodyText: string): number {
  if (parseScoreOutOf10(bodyText) === null) return 0;
  return lineHeight(9) + BAR_H + 6;
}

function drawHealthBarOnly(ctx: Ctx, bodyText: string, x: number, maxW: number) {
  const sc = parseScoreOutOf10(bodyText);
  if (sc === null) return;
  const scoreStr = `${sc}/10`;
  const lh = lineHeight(9);
  const yLine = ctx.y - 10;
  const sw = measureTrackedWidth(scoreStr, ctx.fontBold, 10, LETTER_TRACKING);
  drawTrackedText(ctx.page, scoreStr, {
    x: x + maxW - sw,
    y: yLine,
    size: 10,
    font: ctx.fontBold,
    color: IRISS_ACCENT,
    tracking: LETTER_TRACKING,
  });
  ctx.y -= lh;
  const trackY = ctx.y - BAR_H;
  ctx.page.drawRectangle({ x, y: trackY, width: maxW, height: BAR_H, color: BAR_TRACK });
  const fillW = Math.min(maxW, maxW * (sc / 10));
  if (fillW > 0.5) {
    ctx.page.drawRectangle({ x, y: trackY, width: fillW, height: BAR_H, color: IRISS_ACCENT });
  }
  ctx.y = trackY - 4;
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

function selectedDealDetailLabels(record: IrissPasutijumsRecord): string[] {
  return IRISS_DEAL_DETAIL_OPTIONS.filter((opt) => Boolean(record[opt.key])).map((opt) => opt.label);
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
    pasutijumsDzLockPage1: false,
    offerLogo: null,
    logoOnlyBand: LOGO_ONLY_BAND,
    cardTheme: { ...IRISS_PDF_CARD_THEME },
  };
}

function drawContentAccentRule(ctx: Ctx) {
  const ruleH = 1;
  ctx.y -= 4;
  if (!ctx.suppressPageBreak) ensureSpace(ctx, ruleH + 14);
  const yb = ctx.y - ruleH;
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yb,
    width: ctx.contentW,
    height: ruleH,
    color: RULE_DARK,
  });
  ctx.y = yb - 12;
}

const DZ_PAS_BODY_FS = 8.75;
const DZ_PAS_HEAD_FS = 8.5;

function drawDzGraySection(
  ctx: Ctx,
  titleDisplay: string,
  measureBody: (iw: number) => number,
  drawBody: (inner: { x: number; w: number }) => void,
): void {
  const pad = 10;
  const ix = ctx.margin + pad;
  const iw = ctx.contentW - pad * 2;
  const headH = dzLineHeight(DZ_PAS_HEAD_FS) + 8;
  const bodyH = measureBody(iw);
  const cardH = pad + headH + bodyH + pad;
  ensureRoomForBlock(ctx, DZ_SECTION_GAP + cardH + DZ_SECTION_GAP);
  ctx.y -= DZ_SECTION_GAP;
  const cTop = ctx.y;
  const cBot = cTop - cardH;
  drawSectionCardWithShadow(ctx.page, {
    x: ctx.margin,
    yBottom: cBot,
    w: ctx.contentW,
    h: cardH,
    fill: DZ_SEC_CARD_FILL,
  });
  let cy = cTop - pad;
  cy -= drawSectionHeadInCard(ctx.page, ix, cy, titleDisplay, ctx.fontBold);
  ctx.y = cy;
  const prev = ctx.suppressPageBreak;
  ctx.suppressPageBreak = true;
  try {
    drawBody({ x: ix, w: iw });
  } finally {
    ctx.suppressPageBreak = prev;
  }
  ctx.y = cBot - DZ_SECTION_GAP;
}

async function drawPasutijumsDzTameHero(ctx: Ctx, record: IrissPasutijumsRecord): Promise<void> {
  const raw = val(record.brandModel) ?? "PASŪTĪJUMS";
  const heroTitle = raw.toLocaleUpperCase("lv-LV");
  const titleUsedH = drawFittedOneLine(
    ctx.page,
    heroTitle,
    ctx.fontBold,
    ctx.margin,
    ctx.y,
    ctx.contentW,
    11,
    8.2,
    DZ_INK,
    0.06,
  );
  ctx.y -= titleUsedH + 4;
  const dateStr = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());
  dzDrawTrackedText(ctx.page, dateStr, {
    x: ctx.margin,
    y: ctx.y - 8,
    size: 8,
    font: ctx.font,
    color: DZ_MUTED,
    tracking: 0.05,
  });
  ctx.y -= dzLineHeight(8) + DZ_SECTION_GAP;
}

function measureDzTermsHeight(contentW: number, font: PDFFont, fontBold: PDFFont, fsP: number, fsH: number, gap: number): number {
  let h = 0;
  for (const block of DZ_PASUTIJUMS_TERMS_BLOCKS) {
    if (block.kind === "h") {
      h += dzWrapText(block.text, fontBold, fsH, contentW).length * dzLineHeight(fsH) + gap;
    } else if (block.kind === "p") {
      h += dzWrapText(block.text, font, fsP, contentW).length * dzLineHeight(fsP) + gap * 0.45;
    } else {
      for (const it of block.items) {
        h += dzWrapText(`• ${it}`, font, fsP, contentW - 10).length * dzLineHeight(fsP);
      }
      h += gap * 0.55;
    }
  }
  return h;
}

function drawDzPasutijumsTermsPage(ctx: Ctx): void {
  const ix = ctx.margin;
  const iw = ctx.contentW;
  const avail = ctx.y - ctx.margin - DZ_FOOTER_BLOCK_H - 12;
  let fsP = 6.55;
  let fsH = 7.35;
  while (fsP >= 5.35 && measureDzTermsHeight(iw, ctx.font, ctx.fontBold, fsP, fsH, 2.5) > avail) {
    fsP -= 0.1;
    fsH -= 0.1;
  }
  for (const block of DZ_PASUTIJUMS_TERMS_BLOCKS) {
    if (block.kind === "h") {
      for (const ln of dzWrapText(block.text, ctx.fontBold, fsH, iw)) {
        dzDrawTrackedText(ctx.page, ln, {
          x: ix,
          y: ctx.y - fsH,
          size: fsH,
          font: ctx.fontBold,
          color: DZ_SEC_HEAD,
          tracking: 0.06,
        });
        ctx.y -= dzLineHeight(fsH);
      }
      ctx.y -= 2;
    } else if (block.kind === "p") {
      for (const ln of dzWrapText(block.text, ctx.font, fsP, iw)) {
        dzDrawTrackedText(ctx.page, ln, {
          x: ix,
          y: ctx.y - fsP,
          size: fsP,
          font: ctx.font,
          color: DZ_INK,
          tracking: 0.04,
        });
        ctx.y -= dzLineHeight(fsP);
      }
      ctx.y -= 1.5;
    } else {
      for (const it of block.items) {
        const line = `• ${it}`;
        for (const ln of dzWrapText(line, ctx.font, fsP, iw - 8)) {
          dzDrawTrackedText(ctx.page, ln, {
            x: ix + 4,
            y: ctx.y - fsP,
            size: fsP,
            font: ctx.font,
            color: DZ_INK,
            tracking: 0.04,
          });
          ctx.y -= dzLineHeight(fsP);
        }
      }
      ctx.y -= 2;
    }
  }
}

function drawFooter(ctx: Ctx) {
  const pad = 11;
  const stripeH = 1;
  const titleS = 9;
  const rowS = 7.2;
  const innerW = ctx.contentW - pad * 2 - 4;
  const footerLines = getIrissPdfSupplierFooterLines();
  const brand = footerLines[0] ?? "";
  const rest = footerLines.slice(1);
  let bodyH = lineHeight(titleS) + 10;
  for (const line of rest) {
    bodyH += measureWrappedBlockHeight(line, ctx.font, rowS, innerW) + 4;
  }
  const h = pad + stripeH + bodyH + pad;
  ensureRoomForBlock(ctx, h + 14);
  ctx.y -= 10;
  const yTop = ctx.y;
  const yBottom = yTop - h;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: yBottom,
    width: ctx.contentW,
    height: h,
    radius: 10,
    color: rgb(252 / 255, 252 / 255, 253 / 255),
    borderColor: CARD_BORDER_SLATE,
    borderWidth: 1,
  });
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: yBottom + h - stripeH,
    width: ctx.contentW,
    height: stripeH,
    color: RULE_DARK,
  });
  ctx.y = yTop - stripeH - 4;
  drawTrackedText(ctx.page, brand.toLocaleUpperCase("lv-LV"), {
    x: ctx.margin + pad + 3,
    y: ctx.y - titleS,
    size: titleS,
    font: ctx.fontBold,
    color: INK,
    tracking: 0.154,
  });
  ctx.y -= lineHeight(titleS) + 8;
  for (const line of rest) {
    drawParagraph(ctx, line, rowS, MUTED, ctx.font, { x: ctx.margin + pad + 3, maxW: innerW });
  }
  ctx.y = yBottom - 8;
}

function fmtMoneyEurLv(total: number): string {
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(total);
}

function drawOrangeSummaryCard(ctx: Ctx, summary: string): void {
  drawIosCard(
    ctx,
    "Kopsavilkums",
    (iw) => measureWrappedBlockHeight(summary, ctx.font, 10, iw),
    ({ x, w }) => drawParagraph(ctx, summary, 10, MUTED, ctx.font, { x, maxW: w }),
  );
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
    const maxW = 56;
    const maxH = 36;
    const s = Math.min(maxW / img.width, maxH / img.height, 1);
    return { img, dw: img.width * s, dh: img.height * s };
  } catch {
    return null;
  }
}

async function drawOfferPdfHero(ctx: Ctx, offer: IrissOfferRecord): Promise<void> {
  const rawTitle = val(offer.brandModel) ?? val(offer.title) ?? "Piedāvājums";
  const heroTitle = rawTitle.toLocaleUpperCase("lv-LV");
  const logo = ctx.offerLogo;
  const lh18 = lineHeight(18);
  const logoBoxW = logo ? logo.dw + 6 : 0;
  const titleColX = ctx.margin + (logo ? logoBoxW + 14 : 0);
  const titleColW = ctx.contentW - (logo ? logoBoxW + 14 : 0);
  const titleLines = wrapText(heroTitle, ctx.fontBold, 18, titleColW);
  const titleH = titleLines.length * lh18;
  const rowH = Math.max(logo ? logo.dh + 6 : 0, titleH);

  ensureSpace(ctx, rowH + lineHeight(11) + 28);
  const rowTopY = ctx.y;

  if (logo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, logo);

  let ty = rowTopY;
  for (const line of titleLines) {
    drawTrackedText(ctx.page, line, {
      x: titleColX,
      y: ty - 18,
      size: 18,
      font: ctx.fontBold,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    ty -= lh18;
  }

  const logoBandBottom = logo ? ctx.pageH - ctx.margin - (logo.dh + 6) : rowTopY;
  const titleBlockBottom = rowTopY - titleLines.length * lh18;
  ctx.y = Math.min(logoBandBottom, titleBlockBottom) - 8;
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 10, MUTED, undefined, {
    x: ctx.margin,
    maxW: ctx.contentW,
  });
  ctx.y -= 6;
  drawContentAccentRule(ctx);
}

export async function buildIrissPasutijumsPdfBytes(record: IrissPasutijumsRecord): Promise<Uint8Array> {
  const ctx = await createPdfCtx();
  ctx.pasutijumsDzLockPage1 = true;
  ctx.offerLogo = await dzLoadOfferLogoPack(ctx.pdfDoc);

  await drawPasutijumsDzTameHero(ctx, record);

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
    drawDzGraySection(
      ctx,
      "KLIENTA DATI",
      (iw) => measureColonLabeledLinesHeight(clientLines, DZ_PAS_BODY_FS, iw, ctx),
      ({ x, w }) => {
        for (const ln of clientLines) drawColonLabeledLine(ctx, ln, DZ_PAS_BODY_FS, x, w);
      },
    );
  }

  const pamatLines: string[] = [];
  const pushP = (label: string, s: string | undefined) => {
    const v = val(s);
    if (v) pamatLines.push(`${label}: ${v}`);
  };
  pushP("Gads / periods", record.productionYears);
  pushP("Maks. nobraukums", record.maxMileage);
  pushP("Transmisija", record.transmission);
  pushP("Dzinēja tips", record.engineType);

  const specLines: string[] = [];
  const bm = val(record.brandModel);
  if (bm) specLines.push(`Marka / modelis: ${bm}`);
  specLines.push(...pamatLines);
  const pushSpec = (label: string, s: string | undefined) => {
    const v = val(s);
    if (v) specLines.push(`${label}: ${v}`);
  };
  pushSpec("Kopējais budžets", record.totalBudget);
  pushSpec("Vēlamās krāsas", record.preferredColors);
  pushSpec("Nevēlamās krāsas", record.nonPreferredColors);
  pushSpec("Salona apdare", record.interiorFinish);
  const selectedDealDetails = selectedDealDetailLabels(record);
  if (selectedDealDetails.length) {
    specLines.push("Darījuma detaļas:");
    for (const label of selectedDealDetails) specLines.push(`${label}: Jā`);
  }
  if (specLines.length) {
    drawDzGraySection(
      ctx,
      "TRANSPORTLĪDZEKĻA SPECIFIKĀCIJA",
      (iw) => measureColonLabeledLinesHeight(specLines, DZ_PAS_BODY_FS, iw, ctx),
      ({ x, w }) => {
        for (const ln of specLines) drawColonLabeledLine(ctx, ln, DZ_PAS_BODY_FS, x, w);
      },
    );
  }

  const req = val(record.equipmentRequired);
  if (req) {
    drawDzGraySection(
      ctx,
      "OBLIGĀTĀS PRASĪBAS (APRĪKOJUMS)",
      (iw) => measureWrappedBlockHeight(req, ctx.font, DZ_PAS_BODY_FS, iw),
      ({ x, w }) => drawParagraph(ctx, req, DZ_PAS_BODY_FS, INK, ctx.font, { x, maxW: w }),
    );
  }
  const des = val(record.equipmentDesired);
  if (des) {
    drawDzGraySection(
      ctx,
      "VĒLAMĀS PRASĪBAS (APRĪKOJUMS)",
      (iw) => measureWrappedBlockHeight(des, ctx.font, DZ_PAS_BODY_FS, iw),
      ({ x, w }) => drawParagraph(ctx, des, DZ_PAS_BODY_FS, INK, ctx.font, { x, maxW: w }),
    );
  }

  const n = val(record.notes);
  if (n) {
    drawDzGraySection(
      ctx,
      "PIEZĪMES",
      (iw) => measureWrappedBlockHeight(n, ctx.font, DZ_PAS_BODY_FS, iw),
      ({ x, w }) => drawParagraph(ctx, n, DZ_PAS_BODY_FS, INK, ctx.font, { x, maxW: w }),
    );
  }

  drawDzintarzemePdfFooter(
    { page: ctx.page, margin: ctx.margin, font: ctx.font, fontBold: ctx.fontBold },
    ctx.offerLogo,
  );

  ctx.pasutijumsDzLockPage1 = false;
  ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
  ctx.y = ctx.pageH - ctx.margin;

  drawDzPasutijumsTermsPage(ctx);

  drawDzintarzemePdfFooter(
    { page: ctx.page, margin: ctx.margin, font: ctx.font, fontBold: ctx.fontBold },
    ctx.offerLogo,
  );

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
  const specialNotes = val(internalCommentHtmlToPdfPlain(offer.specialNotes ?? ""));
  const visual = val(internalCommentHtmlToPdfPlain(offer.visualAssessment ?? ""));
  const technical = val(internalCommentHtmlToPdfPlain(offer.technicalAssessment ?? ""));
  const summary = val(internalCommentHtmlToPdfPlain(offer.summary ?? ""));

  if (assessmentChecks.length) {
    drawIosCard(
      ctx,
      "Novērtējuma atzīmes",
      (iw) => measureLinesHeight(assessmentChecks, ctx.fontBold, 10, iw),
      ({ x, w }) => {
        for (const ln of assessmentChecks) {
          drawParagraph(ctx, ln, 10, IRISS_ACCENT, ctx.fontBold, { x, maxW: w });
        }
      },
    );
  }

  if (specialNotes) {
    drawIosCard(
      ctx,
      "Īpašas atzīmes",
      (iw) => measureWrappedBlockHeight(specialNotes, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, specialNotes, 10, MUTED, ctx.font, { x, maxW: w }),
    );
  }

  if (visual && parseScoreOutOf10(visual) !== null) {
    drawIosCard(
      ctx,
      "Vizuālais novērtējums",
      () => measureHealthBarOnly(visual),
      ({ x, w }) => drawHealthBarOnly(ctx, visual, x, w),
    );
  }

  if (visual) {
    drawIosCard(
      ctx,
      "Detalizēts apraksts (vizuālais)",
      (iw) => measureWrappedBlockHeight(visual, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, visual, 10, MUTED, ctx.font, { x, maxW: w }),
    );
  }

  if (technical && parseScoreOutOf10(technical) !== null) {
    drawIosCard(
      ctx,
      "Tehniskais novērtējums",
      () => measureHealthBarOnly(technical),
      ({ x, w }) => drawHealthBarOnly(ctx, technical, x, w),
    );
  }

  if (technical) {
    drawIosCard(
      ctx,
      "Detalizēts apraksts (tehniskais)",
      (iw) => measureWrappedBlockHeight(technical, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, technical, 10, MUTED, ctx.font, { x, maxW: w }),
    );
  }

  if (summary) {
    drawOrangeSummaryCard(ctx, summary);
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
      const outerChrome = SECTION_BEFORE + SECTION_AFTER + cardVerticalChrome;
      let picIdx = 0;
      while (picIdx < pics.length) {
        let innerAvailable = ctx.y - ctx.margin - FOOTER_SAFE - outerChrome;
        let maxRows = Math.floor(innerAvailable / rowPixel);
        let guard = 0;
        while (maxRows < 1 && guard < 8) {
          guard += 1;
          ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
          if (ctx.offerLogo) stampOfferLogoTopLeft(ctx.page, ctx.pageH, ctx.margin, ctx.offerLogo);
          ctx.y = ctx.pageH - ctx.margin - (ctx.offerLogo ? ctx.logoOnlyBand : 0);
          innerAvailable = ctx.y - ctx.margin - FOOTER_SAFE - outerChrome;
          maxRows = Math.floor(innerAvailable / rowPixel);
        }
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
          { omitFrame: true },
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
