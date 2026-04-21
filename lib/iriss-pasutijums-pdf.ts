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

const ACCENT = rgb(239 / 255, 125 / 255, 26 / 255);
const INK = rgb(29 / 255, 29 / 255, 31 / 255);
const MUTED = rgb(110 / 255, 110 / 255, 115 / 255);

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
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

function drawTextLine(ctx: Ctx, text: string, size: number, opts?: { font?: PDFFont; color?: ReturnType<typeof rgb> }) {
  const f = opts?.font ?? ctx.font;
  const c = opts?.color ?? INK;
  ensureSpace(ctx, lineHeight(size));
  ctx.page.drawText(text, { x: ctx.margin, y: ctx.y, size, font: f, color: c });
  ctx.y -= lineHeight(size);
}

function drawParagraph(ctx: Ctx, text: string, size: number, color = INK, f?: PDFFont) {
  const font = f ?? ctx.font;
  for (const ln of wrapText(text, font, size, ctx.contentW)) {
    drawTextLine(ctx, ln, size, { font, color });
  }
}

function drawSectionTitle(ctx: Ctx, title: string) {
  ctx.y -= 4;
  drawTextLine(ctx, title, 9, { font: ctx.fontBold, color: ACCENT });
  ctx.y -= 2;
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

function fmtMoney(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(".", ",");
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

function drawImageRow2Col(ctx: Ctx, left: EmbeddedPic, right: EmbeddedPic | null, cellW: number, colGap: number, maxCellH: number) {
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
    x: ctx.margin + (cellW - dwL) / 2,
    y: topY - dhL,
    width: dwL,
    height: dhL,
  });
  if (right) {
    ctx.page.drawImage(right.img, {
      x: ctx.margin + cellW + colGap + (cellW - dwR) / 2,
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
  const font = await pdfDoc.embedFont(reg, { subset: true });
  const fontBold = await pdfDoc.embedFont(bold, { subset: true });
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

export async function buildIrissPasutijumsPdfBytes(record: IrissPasutijumsRecord): Promise<Uint8Array> {
  const ctx = await createPdfCtx();

  drawTextLine(ctx, "PASŪTĪJUMS", 18, { font: ctx.fontBold, color: ACCENT });
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 9, MUTED);
  ctx.y -= 8;

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
    drawSectionTitle(ctx, "Klienta dati");
    for (const ln of clientLines) drawParagraph(ctx, ln, 10);
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
    drawSectionTitle(ctx, "Transportlīdzekļa specifikācija");
    for (const ln of vehLines) drawParagraph(ctx, ln, 10);
  }

  const req = val(record.equipmentRequired);
  if (req) {
    drawSectionTitle(ctx, "Obligātās prasības (aprīkojums)");
    drawParagraph(ctx, req, 10);
  }
  const des = val(record.equipmentDesired);
  if (des) {
    drawSectionTitle(ctx, "Vēlamās prasības (aprīkojums)");
    drawParagraph(ctx, des, 10);
  }

  const n = val(record.notes);
  if (n) {
    drawSectionTitle(ctx, "Piezīmes");
    drawParagraph(ctx, n, 10);
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
    drawSectionTitle(ctx, "Sludinājumu saites");
    for (const ln of links) drawParagraph(ctx, ln, 9);
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
  const heroTitle = val(offer.brandModel) ?? val(offer.title) ?? "Piedāvājums";

  drawTextLine(ctx, heroTitle, 16, { font: ctx.fontBold, color: ACCENT });
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 9, MUTED);
  ctx.y -= 8;

  const clientLines: string[] = [];
  const name = `${record.clientFirstName} ${record.clientLastName}`.trim();
  if (name) clientLines.push(`Klients: ${name}`);
  const ph = val(record.phone);
  if (ph) clientLines.push(`Tālrunis: ${ph}`);
  const em = val(record.email);
  if (em) clientLines.push(`E-pasts: ${em}`);
  if (clientLines.length) {
    drawSectionTitle(ctx, "Klienta dati");
    for (const ln of clientLines) drawParagraph(ctx, ln, 10);
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
    drawSectionTitle(ctx, "Pamatinformācija");
    for (const ln of offerLines) drawParagraph(ctx, ln, 10);
  }

  const assessmentChecks: string[] = [];
  if (offer.hasFullServiceHistory) assessmentChecks.push("☑ Pilna servisa vēsture");
  if (offer.hasFactoryPaint) assessmentChecks.push("☑ Rūpnīcas krāsojums");
  if (offer.hasNoRustBody) assessmentChecks.push("☑ Virsbūve bez rūsas");
  if (offer.hasSecondWheelSet) assessmentChecks.push("☑ Otrs riteņu komplekts");
  const visual = val(offer.visualAssessment);
  const technical = val(offer.technicalAssessment);
  if (assessmentChecks.length > 0 || visual || technical) {
    drawSectionTitle(ctx, "Vispārējais novērtējums");
    for (const ln of assessmentChecks) drawParagraph(ctx, ln, 10);
    if (visual) {
      drawParagraph(ctx, "Vizuālais novērtējums:", 10, MUTED, ctx.fontBold);
      drawParagraph(ctx, visual, 10);
    }
    if (technical) {
      drawParagraph(ctx, "Tehniskais novērtējums:", 10, MUTED, ctx.fontBold);
      drawParagraph(ctx, technical, 10);
    }
  }

  const carPrice = val(offer.carPrice) ?? val(offer.priceGermany);
  const deliveryPrice = val(offer.deliveryPrice);
  const commissionFee = val(offer.commissionFee);
  const totalPrice = parseMoney(carPrice ?? "") + parseMoney(deliveryPrice ?? "") + parseMoney(commissionFee ?? "");
  const pricingLines: string[] = [];
  if (carPrice) pricingLines.push(`Automašīnas cena: ${carPrice}`);
  if (deliveryPrice) pricingLines.push(`Piegādes cena: ${deliveryPrice}`);
  if (commissionFee) pricingLines.push(`Komisijas maksa: ${commissionFee}`);
  if (totalPrice > 0) pricingLines.push(`Kopā: ${fmtMoney(totalPrice)}`);
  if (val(offer.offerValidDays)) pricingLines.push(`Piedāvājums spēkā (dienas): ${val(offer.offerValidDays)}`);
  if (pricingLines.length > 0) {
    drawSectionTitle(ctx, "Cenas un piedāvājums");
    for (const ln of pricingLines) drawParagraph(ctx, ln, 10);
  }

  const imageAttachments = offer.attachments.filter(
    (a) => a.mimeType.startsWith("image/") && a.dataUrl.startsWith("data:image/"),
  );
  const other = offer.attachments.filter((a) => !imageAttachments.includes(a));

  if (!embedImages && imageAttachments.length > 0) {
    drawSectionTitle(ctx, "Pievienotie attēli");
    drawParagraph(ctx, "Attēli šajā eksportā nav iekļauti (ātrs PDF bez attēliem).", 9, MUTED);
  } else if (embedImages && imageAttachments.length > 0) {
    const pics: EmbeddedPic[] = [];
    for (const att of imageAttachments) {
      const emb = await tryEmbedOfferImage(ctx.pdfDoc, att.dataUrl);
      if (emb) pics.push(emb);
    }
    if (pics.length > 0) {
      drawSectionTitle(ctx, "Fotogrāfijas");
      const COL_GAP = 12;
      const cellW = (ctx.contentW - COL_GAP) / 2;
      const MAX_CELL_H = 195;
      for (let i = 0; i < pics.length; i += 2) {
        drawImageRow2Col(ctx, pics[i]!, pics[i + 1] ?? null, cellW, COL_GAP, MAX_CELL_H);
      }
    }
  }

  if (other.length > 0) {
    drawSectionTitle(ctx, "Fotogrāfiju pielikumi");
    for (let i = 0; i < other.length; i++) {
      drawParagraph(ctx, `${i + 1}. ${other[i].name}`, 9);
    }
  }

  drawFooter(ctx);
  return ctx.pdfDoc.save();
}
