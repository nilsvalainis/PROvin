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
const MUTED = rgb(82 / 255, 82 / 255, 91 / 255);
const SEC_HEAD = rgb(63 / 255, 63 / 255, 70 / 255);
const ACCENT_BAR = rgb(55 / 255, 65 / 255, 75 / 255);
const SEC_CARD_FILL = rgb(244 / 255, 244 / 255, 245 / 255);
const SEC_CARD_BORDER = rgb(212 / 255, 212 / 255, 216 / 255);
const SEC_SHADOW = rgb(228 / 255, 228 / 255, 231 / 255);

/**
 * Informatīvs atgādinājums (PVN likums, 138.pants — peļņas daļas režīms).
 */
const LV_PVN_TAME_LEGAL_NOTE =
  "Lietotam transportlīdzeklim piemērots PVN likuma 138. panta režīms (peļņas daļas nodoklis). Komisijas maksai un papildu pakalpojumiem piemērota PVN standartlikme 21%. PVN kopsumma norādīta kopsavilkumā.";
const LETTER_TRACKING = 0.18;
/** Kājene + drošā zona — viena A4 lapa, bez otras lapas. */
const FOOTER_BLOCK_H = 96;
const SECTION_GAP = 10;
const CARD_RADIUS = 6;
const SHADOW_OFFSET = 1.25;

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
  return Math.round(size * 1.35);
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

/** Ēnas imitācija: nedaudz nobīdīts gaišāks pelēks slānis zem kartītes. */
function drawSectionCardWithShadow(
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
};

/** Viena lapa — neatveram otro lapu. */
function reserveVertical(ctx: PdfCtx, need: number, floorY: number): void {
  if (ctx.y - need < floorY) {
    ctx.y = floorY + need;
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
  const margin = 44;
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
  };
}

function drawSectionHeadInCard(
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

/** Viena rinda: samazina fontu, līdz ietilpst; citādi saīsina ar …. */
function drawFittedOneLine(
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

function drawFooter(ctx: PdfCtx, logo: LogoPack | null): void {
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

/** Dzintarzeme Auto tāmes PDF — viena A4 lapa, kājene ar logo un kontaktiem. */
export async function generateDzintarzemeTamePdfBytes(input: DzintarzemeTameInput): Promise<Uint8Array> {
  const c = computeDzintarzemeTame(input);
  const ctx = await createCtx();
  const floorY = ctx.margin + FOOTER_BLOCK_H;
  const page = ctx.page;

  const footerLogo = await loadOfferLogoPack(ctx.pdfDoc);

  const docTitle = "AUTOMAŠĪNAS PASŪTĪJUMA IZMAKASU TĀME";
  const dateStr = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());

  reserveVertical(ctx, lineHeight(11) + lineHeight(8) + 14, floorY);
  const titleMaxW = ctx.contentW;
  const titleUsedH = drawFittedOneLine(
    page,
    docTitle,
    ctx.fontBold,
    ctx.margin,
    ctx.y,
    titleMaxW,
    11,
    8.2,
    INK,
    0.06,
  );
  ctx.y -= titleUsedH + 4;
  drawTrackedText(page, dateStr, {
    x: ctx.margin,
    y: ctx.y - 8,
    size: 8,
    font: ctx.font,
    color: MUTED,
    tracking: 0.05,
  });
  ctx.y -= lineHeight(8) + SECTION_GAP;

  const innerPad = 10;
  const ix0 = ctx.margin + innerPad;
  const iw = ctx.contentW - innerPad * 2;

  const b = c.input.brandModel.trim();
  const v = c.input.vin.trim();
  const headPas = lineHeight(8.5) + 8;
  const lineBm = b ? lineHeight(9) + 6 : 0;
  const lineVin = v ? lineHeight(8.5) + 6 : 0;
  const card1H = innerPad + headPas + lineBm + lineVin + innerPad + 2;
  reserveVertical(ctx, card1H + SECTION_GAP, floorY);
  const c1Top = ctx.y;
  const c1Bot = c1Top - card1H;
  drawSectionCardWithShadow(page, { x: ctx.margin, yBottom: c1Bot, w: ctx.contentW, h: card1H, fill: SEC_CARD_FILL });

  let cy = c1Top - innerPad;
  cy -= drawSectionHeadInCard(page, ix0, cy, "PASŪTĪJUMS", ctx.fontBold);

  if (b) {
    const line = `Marka / modelis: ${b}`;
    cy -= drawFittedOneLine(page, line, ctx.fontBold, ix0, cy, iw, 9, 7, INK, 0.05) + 2;
  }
  if (v) {
    const line = `VIN: ${v.toUpperCase()}`;
    cy -= drawFittedOneLine(page, line, ctx.fontBold, ix0, cy, iw, 8.5, 7, INK, 0.06) + 2;
  }
  ctx.y = c1Bot - SECTION_GAP;

  const visibleRows = c.tableRows.filter((r) => r.net > 0);
  const labelWrapW = Math.max(120, ctx.contentW - innerPad * 2 - 100);
  const colRight = ctx.margin + ctx.contentW - innerPad - 2;
  const fsRow = 8.5;
  const fsSub = 6.8;
  const lhRow = lineHeight(fsRow);
  const lhSub = lineHeight(fsSub);

  let bodyH = innerPad;
  const headIzm = lineHeight(8.5) + 8;
  bodyH += headIzm;
  const hdrRowH = lineHeight(8) + 6;
  bodyH += hdrRowH;
  for (const row of visibleRows) {
    const labelLines = wrapText(row.label, ctx.font, fsRow, labelWrapW);
    const subH = row.subtitle ? lhSub : 0;
    bodyH += Math.max(labelLines.length * lhRow, lhRow) + subH + 5;
  }
  bodyH += 6;
  const noteLines = wrapText(LV_PVN_TAME_LEGAL_NOTE, ctx.font, 6.5, iw);
  bodyH += noteLines.length * lineHeight(6.5) + innerPad;

  const card2H = bodyH;
  reserveVertical(ctx, card2H + SECTION_GAP, floorY);
  const c2Top = ctx.y;
  const c2Bot = c2Top - card2H;
  drawSectionCardWithShadow(page, { x: ctx.margin, yBottom: c2Bot, w: ctx.contentW, h: card2H, fill: SEC_CARD_FILL });

  cy = c2Top - innerPad;
  cy -= drawSectionHeadInCard(page, ix0, cy, "IZMAKSU APRĒĶINS", ctx.fontBold);

  drawTrackedText(page, "Apraksts", {
    x: ix0,
    y: cy - 8,
    size: 8,
    font: ctx.fontBold,
    color: SEC_HEAD,
    tracking: 0.06,
  });
  const netH = "EUR (neto)";
  const nw = measureTrackedWidth(netH, ctx.fontBold, 8, 0.08);
  drawTrackedText(page, netH, {
    x: colRight - nw,
    y: cy - 8,
    size: 8,
    font: ctx.fontBold,
    color: SEC_HEAD,
    tracking: 0.08,
  });
  cy -= hdrRowH;

  for (const row of visibleRows) {
    const labelLines = wrapText(row.label, ctx.font, fsRow, labelWrapW);
    const subH = row.subtitle ? lhSub : 0;
    const rowH = Math.max(labelLines.length * lhRow, lhRow) + subH + 5;
    const rowTop = cy;
    let ly = rowTop;
    for (const ll of labelLines) {
      drawTrackedText(page, ll, {
        x: ix0,
        y: ly - fsRow,
        size: fsRow,
        font: ctx.fontBold,
        color: INK,
        tracking: 0.05,
      });
      ly -= lhRow;
    }
    if (row.subtitle) {
      drawTrackedText(page, row.subtitle, {
        x: ix0,
        y: ly - fsSub,
        size: fsSub,
        font: ctx.font,
        color: MUTED,
        tracking: 0.04,
      });
    }
    const amt = fmtMoneyEurLv(row.net);
    const aw = measureTrackedWidth(amt, ctx.fontBold, 9, 0.08);
    drawTrackedText(page, amt, {
      x: colRight - aw,
      y: rowTop - fsRow,
      size: 9,
      font: ctx.fontBold,
      color: INK,
      tracking: 0.08,
    });
    cy = rowTop - rowH;
  }

  cy -= 4;
  for (const nl of noteLines) {
    drawTrackedText(page, nl, {
      x: ix0,
      y: cy - 6.5,
      size: 6.5,
      font: ctx.font,
      color: MUTED,
      tracking: 0.03,
    });
    cy -= lineHeight(6.5);
  }
  ctx.y = c2Bot - SECTION_GAP;

  const sumHead = lineHeight(8.5) + 8;
  const sumRowN = lineHeight(9.5) + 6;
  const sumRowG = lineHeight(10.5) + 8;
  const card3H = innerPad + sumHead + sumRowN * 2 + sumRowG + innerPad;
  reserveVertical(ctx, card3H + SECTION_GAP + lineHeight(7) * 2 + 8, floorY);
  const c3Top = ctx.y;
  const c3Bot = c3Top - card3H;
  drawSectionCardWithShadow(page, { x: ctx.margin, yBottom: c3Bot, w: ctx.contentW, h: card3H, fill: SEC_CARD_FILL });

  cy = c3Top - innerPad;
  cy -= drawSectionHeadInCard(page, ix0, cy, "KOPĒJĀS IZMAKAS", ctx.fontBold);

  const drawSum = (lab: string, val: string, strong: boolean) => {
    const lf = strong ? 10.5 : 9.5;
    const vf = strong ? 10.5 : 9.5;
    drawTrackedText(page, lab, {
      x: ix0,
      y: cy - lf,
      size: lf,
      font: strong ? ctx.fontBold : ctx.font,
      color: INK,
      tracking: 0.05,
    });
    const vw = measureTrackedWidth(val, ctx.fontBold, vf, 0.08);
    drawTrackedText(page, val, {
      x: colRight - vw,
      y: cy - vf,
      size: vf,
      font: ctx.fontBold,
      color: INK,
      tracking: 0.08,
    });
    cy -= strong ? sumRowG : sumRowN;
  };

  drawSum("Kopā bez PVN (neto bāze)", fmtMoneyEurLv(c.summaBezPVN), false);
  drawSum("PVN 21 %", fmtMoneyEurLv(c.pvnKopa), false);
  drawSum("GALA SUMMA APMAKSAI", fmtMoneyEurLv(c.galaSumma), true);
  ctx.y = c3Bot - SECTION_GAP;

  const disclaimer = "Šis aprēķins ir informatīvs un nav uzskatāms par oficiālu rēķinu.";
  for (const ln of wrapText(disclaimer, ctx.font, 7, ctx.contentW - 8)) {
    reserveVertical(ctx, lineHeight(7), floorY);
    drawTrackedText(page, ln, {
      x: ctx.margin,
      y: ctx.y - 7,
      size: 7,
      font: ctx.font,
      color: MUTED,
      tracking: 0.04,
    });
    ctx.y -= lineHeight(7);
  }

  drawFooter(ctx, footerLogo);

  return ctx.pdfDoc.save();
}

export const generateDzintarzemeTame = generateDzintarzemeTamePdfBytes;
