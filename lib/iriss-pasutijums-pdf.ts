import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

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

/** PROVIN orange */
const ACCENT = rgb(239 / 255, 125 / 255, 26 / 255);
const INK = rgb(29 / 255, 29 / 255, 31 / 255);
const MUTED = rgb(110 / 255, 110 / 255, 115 / 255);
const CARD_FILL = rgb(252 / 255, 250 / 255, 247 / 255);
const CARD_BORDER = rgb(239 / 255, 213 / 255, 183 / 255);
const PRICE_BAND_FILL = rgb(255 / 255, 244 / 255, 232 / 255);
const PRICE_BAND_BORDER = rgb(217 / 255, 112 / 255, 29 / 255);
const SECTION_BEFORE = 14;
const SECTION_AFTER = 10;
const LETTER_TRACKING = 0.22;

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
  return Math.round(size * 1.38);
}

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
};

function ensureSpace(ctx: Ctx, need: number): void {
  if (ctx.y - need < ctx.margin + 36) {
    ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
    ctx.y = ctx.pageH - ctx.margin;
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

/**
 * Vieglas kartītes fons + apmale (zīmēts pirms teksta), admin iOS stilam līdzīgi.
 */
function drawIosCard(
  ctx: Ctx,
  title: string,
  measureBody: (innerW: number) => number,
  drawBody: (inner: { x: number; w: number }) => void,
): void {
  const pad = 10;
  const radius = 10;
  const ix = ctx.margin + pad;
  const iw = ctx.contentW - pad * 2;
  const titleBlock = lineHeight(13) + 6;
  const bodyH = measureBody(iw);
  const h = pad + titleBlock + bodyH + pad;

  ctx.y -= SECTION_BEFORE;
  const yTopCard = ctx.y;
  const yRectBottom = yTopCard - h;
  drawRoundedRect(ctx.page, {
    x: ctx.margin,
    y: yRectBottom,
    width: ctx.contentW,
    height: h,
    radius,
    color: CARD_FILL,
    borderColor: CARD_BORDER,
    borderWidth: 0.85,
  });
  ctx.y = yRectBottom + h - pad;
  drawTextLine(ctx, title, 13, { font: ctx.fontBold, color: ACCENT, x: ix });
  ctx.y -= 6;
  drawBody({ x: ix, w: iw });
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
  ensureSpace(ctx, rowH + 14);
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
  const h = 46;
  ctx.y -= 8;
  const yTop = ctx.y;
  const yBottom = yTop - h;
  drawRoundedRect(ctx.page, {
    x: boxX,
    y: yBottom,
    width: boxW,
    height: h,
    radius: 8,
    color: PRICE_BAND_FILL,
    borderColor: PRICE_BAND_BORDER,
    borderWidth: 1.05,
  });
  const baseline = yBottom + 16;
  drawTrackedText(ctx.page, label, {
    x: boxX + 12,
    y: baseline,
    size: 12,
    font: ctx.fontBold,
    color: INK,
    tracking: LETTER_TRACKING,
  });
  const fs = 17;
  const amtW = measureTrackedWidth(amountStr, ctx.fontBold, fs, LETTER_TRACKING);
  drawTrackedText(ctx.page, amountStr, {
    x: boxX + boxW - 14 - amtW,
    y: baseline - 1,
    size: fs,
    font: ctx.fontBold,
    color: INK,
    tracking: LETTER_TRACKING,
  });
  ctx.y = yBottom - 10;
}

async function drawOfferPdfHero(ctx: Ctx, offer: IrissOfferRecord): Promise<void> {
  const heroTitle = val(offer.brandModel) ?? val(offer.title) ?? "Piedāvājums";
  let logo: PDFImage | null = null;
  let dw = 0;
  let dh = 0;
  try {
    const buf = await fs.readFile(DZINTARZEME_OFFER_LOGO_PATH);
    try {
      logo = await ctx.pdfDoc.embedPng(buf);
    } catch {
      logo = await ctx.pdfDoc.embedJpg(buf);
    }
    const maxW = 56;
    const maxH = 36;
    const s = Math.min(maxW / logo.width, maxH / logo.height, 1);
    dw = logo.width * s;
    dh = logo.height * s;
  } catch {
    logo = null;
  }

  const lh20 = lineHeight(20);
  const titleColX = ctx.margin + (logo && dh > 0 ? dw + 14 : 0);
  const titleColW = ctx.contentW - (logo && dh > 0 ? dw + 14 : 0);
  const titleLines = wrapText(heroTitle, ctx.fontBold, 20, titleColW);
  const titleH = titleLines.length * lh20;
  const rowH = Math.max(dh > 0 ? dh + 10 : 0, titleH);

  ensureSpace(ctx, rowH + lineHeight(11) + 18);
  const rowTopY = ctx.y;

  if (logo && dh > 0) {
    const logoFrameW = dw + 8;
    const logoFrameH = dh + 8;
    const logoX = ctx.margin;
    const logoY = rowTopY - logoFrameH + 3;
    drawRoundedRect(ctx.page, {
      x: logoX,
      y: logoY,
      width: logoFrameW,
      height: logoFrameH,
      radius: 8,
      color: rgb(1, 1, 1),
      borderColor: CARD_BORDER,
      borderWidth: 0.7,
    });
    ctx.page.drawImage(logo, {
      x: logoX + 4,
      y: logoY + 4,
      width: dw,
      height: dh,
    });
  }

  let ty = rowTopY;
  for (const line of titleLines) {
    drawTrackedText(ctx.page, line, {
      x: titleColX,
      y: ty - 20,
      size: 20,
      font: ctx.fontBold,
      color: INK,
      tracking: LETTER_TRACKING,
    });
    ty -= lh20;
  }

  ctx.y = rowTopY - rowH - 8;
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 10, MUTED, undefined, {
    x: ctx.margin,
    maxW: ctx.contentW,
  });
  ctx.y -= 10;
}

export async function buildIrissPasutijumsPdfBytes(record: IrissPasutijumsRecord): Promise<Uint8Array> {
  const ctx = await createPdfCtx();

  drawTextLine(ctx, "PASŪTĪJUMS", 20, { font: ctx.fontBold, color: ACCENT });
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
      (iw) => measureLinesHeight(clientLines, ctx.font, 10, iw),
      ({ x, w }) => {
        for (const ln of clientLines) drawParagraph(ctx, ln, 10, INK, ctx.fontBold, { x, maxW: w });
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
      (iw) => measureLinesHeight(vehLines, ctx.font, 10, iw),
      ({ x, w }) => {
        for (const ln of vehLines) drawParagraph(ctx, ln, 10, INK, ctx.fontBold, { x, maxW: w });
      },
    );
  }

  const req = val(record.equipmentRequired);
  if (req) {
    drawIosCard(
      ctx,
      "Obligātās prasības (aprīkojums)",
      (iw) => measureWrappedBlockHeight(req, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, req, 10, INK, ctx.fontBold, { x, maxW: w }),
    );
  }
  const des = val(record.equipmentDesired);
  if (des) {
    drawIosCard(
      ctx,
      "Vēlamās prasības (aprīkojums)",
      (iw) => measureWrappedBlockHeight(des, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, des, 10, INK, ctx.fontBold, { x, maxW: w }),
    );
  }

  const n = val(record.notes);
  if (n) {
    drawIosCard(
      ctx,
      "Piezīmes",
      (iw) => measureWrappedBlockHeight(n, ctx.font, 10, iw),
      ({ x, w }) => drawParagraph(ctx, n, 10, INK, ctx.fontBold, { x, maxW: w }),
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
      (iw) => measureLinesHeight(links, ctx.font, 9, iw),
      ({ x, w }) => {
        for (const ln of links) drawParagraph(ctx, ln, 9, INK, ctx.fontBold, { x, maxW: w });
      },
    );
  }

  drawFooter(ctx);
  return ctx.pdfDoc.save();
}

export type BuildIrissOfferPdfOptions = {
  embedImages?: boolean;
};

export async function buildIrissOfferPdfBytes(
  record: IrissPasutijumsRecord,
  offer: IrissOfferRecord,
  opts?: BuildIrissOfferPdfOptions,
): Promise<Uint8Array> {
  const embedImages = opts?.embedImages !== false;
  const ctx = await createPdfCtx();

  await drawOfferPdfHero(ctx, offer);

  const clientLines: string[] = [];
  const name = `${record.clientFirstName} ${record.clientLastName}`.trim();
  if (name) clientLines.push(`Klients: ${name}`);
  const ph = val(record.phone);
  if (ph) clientLines.push(`Tālrunis: ${ph}`);
  const em = val(record.email);
  if (em) clientLines.push(`E-pasts: ${em}`);
  if (clientLines.length) {
    drawIosCard(
      ctx,
      "Klienta dati",
      (iw) => measureLinesHeight(clientLines, ctx.font, 10, iw),
      ({ x, w }) => {
        for (const ln of clientLines) drawParagraph(ctx, ln, 10, INK, ctx.fontBold, { x, maxW: w });
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
      (iw) => measureLinesHeight(offerLines, ctx.font, 10, iw),
      ({ x, w }) => {
        for (const ln of offerLines) drawParagraph(ctx, ln, 10, INK, ctx.fontBold, { x, maxW: w });
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
        drawParagraph(ctx, "Īpašas atzīmes:", 10, MUTED, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, specialNotes, 10, INK, ctx.fontBold, { x, maxW: w });
        filled = true;
      }
      if (visual) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Vizuālais novērtējums:", 10, MUTED, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, visual, 10, INK, ctx.fontBold, { x, maxW: w });
        filled = true;
      }
      if (technical) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Tehniskais novērtējums:", 10, MUTED, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, technical, 10, INK, ctx.fontBold, { x, maxW: w });
        filled = true;
      }
      if (summary) {
        if (filled) ctx.y -= partGap;
        drawParagraph(ctx, "Kopsavilkums:", 10, MUTED, ctx.fontBold, { x, maxW: w });
        drawParagraph(ctx, summary, 10, INK, ctx.fontBold, { x, maxW: w });
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
  const hasPricing =
    pricingPlainLines.length > 0 || totalPrice > 0 || !!offerValidDays;

  if (hasPricing) {
    drawIosCard(ctx, "Cenas un piedāvājums", (iw) => {
      let h = measureLinesHeight(pricingPlainLines, ctx.font, 10, iw);
      if (totalPrice > 0) {
        if (h > 0) h += 8;
        h += 46 + 10;
      }
      if (offerValidDays) {
        if (h > 0) h += 6;
        h += measureWrappedBlockHeight(`Piedāvājums spēkā (dienas): ${offerValidDays}`, ctx.font, 10, iw);
      }
      return h;
    }, ({ x, w }) => {
      for (const ln of pricingPlainLines) {
        drawParagraph(ctx, ln, 10, INK, ctx.fontBold, { x, maxW: w });
      }
      if (totalPrice > 0) {
        if (pricingPlainLines.length > 0) ctx.y -= 6;
        drawKopaHighlightBand(ctx, x, w, totalPrice);
      }
      if (offerValidDays) {
        ctx.y -= 4;
        drawParagraph(ctx, `Piedāvājums spēkā (dienas): ${offerValidDays}`, 10, INK, ctx.fontBold, { x, maxW: w });
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
      const rows = Math.ceil(pics.length / 2);
      const rowPixel = MAX_CELL_H + 14;
      drawIosCard(
        ctx,
        "Fotogrāfijas",
        () => rows * rowPixel,
        ({ x, w }) => {
          const cw = (w - COL_GAP) / 2;
          for (let i = 0; i < pics.length; i += 2) {
            drawImageRow2Col(ctx, pics[i]!, pics[i + 1] ?? null, cw, COL_GAP, MAX_CELL_H, x);
          }
        },
      );
    }
  }

  if (other.length > 0) {
    const lines = other.map((a, i) => `${i + 1}. ${a.name}`);
    drawIosCard(
      ctx,
      "Fotogrāfiju pielikumi",
      (iw) => measureLinesHeight(lines, ctx.font, 9, iw),
      ({ x, w }) => {
        for (const ln of lines) drawParagraph(ctx, ln, 9, INK, ctx.fontBold, { x, maxW: w });
      },
    );
  }

  drawFooter(ctx);
  return ctx.pdfDoc.save();
}
