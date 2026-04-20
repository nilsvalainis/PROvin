import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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

/** Maks. base64 garums pirms `Buffer.from` — aizsardzība pret OOM serverī. */
const MAX_IMAGE_DATAURL_BASE64_CHARS = 1_800_000;

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

  drawSectionTitle(ctx, "Klienta dati");
  drawParagraph(ctx, `Vārds: ${record.clientFirstName.trim() || "—"}`, 10);
  drawParagraph(ctx, `Uzvārds: ${record.clientLastName.trim() || "—"}`, 10);
  drawParagraph(ctx, `Tālrunis: ${record.phone.trim() || "—"}`, 10);
  drawParagraph(ctx, `E-pasts: ${record.email.trim() || "—"}`, 10);
  drawParagraph(ctx, `Pasūtījuma datums: ${record.orderDate.trim() || "—"}`, 10);

  drawSectionTitle(ctx, "Transportlīdzekļa specifikācija");
  drawParagraph(ctx, `Marka / modelis: ${record.brandModel.trim() || "—"}`, 10);
  drawParagraph(ctx, `Ražošanas gadi: ${record.productionYears.trim() || "—"}`, 10);
  drawParagraph(ctx, `Kopējais budžets: ${record.totalBudget.trim() || "—"}`, 10);
  drawParagraph(ctx, `Dzinēja tips: ${record.engineType.trim() || "—"}`, 10);
  drawParagraph(ctx, `Ātrumkārba: ${record.transmission.trim() || "—"}`, 10);
  drawParagraph(ctx, `Maks. nobraukums: ${record.maxMileage.trim() || "—"}`, 10);
  drawParagraph(ctx, `Vēlamās krāsas: ${record.preferredColors.trim() || "—"}`, 10);
  drawParagraph(ctx, `Nevēlamās krāsas: ${record.nonPreferredColors.trim() || "—"}`, 10);
  drawParagraph(ctx, `Salona apdare: ${record.interiorFinish.trim() || "—"}`, 10);

  drawSectionTitle(ctx, "Obligātās prasības (aprīkojums)");
  drawParagraph(ctx, record.equipmentRequired.trim() || "—", 10);

  drawSectionTitle(ctx, "Vēlamās prasības (aprīkojums)");
  drawParagraph(ctx, record.equipmentDesired.trim() || "—", 10);

  drawSectionTitle(ctx, "Piezīmes");
  drawParagraph(ctx, record.notes.trim() || "—", 10);

  const links: string[] = [];
  const push = (label: string, v: string) => {
    const t = v.trim();
    if (t) links.push(`${label}: ${t}`);
  };
  push("Mobile", record.listingLinkMobile);
  push("Autobid", record.listingLinkAutobid);
  push("Openline", record.listingLinkOpenline);
  push("Auto1", record.listingLinkAuto1);
  for (let i = 0; i < record.listingLinksOther.length; i++) {
    const t = record.listingLinksOther[i]?.trim();
    if (t) links.push(`Cits ${i + 1}: ${t}`);
  }
  if (links.length) {
    drawSectionTitle(ctx, "Sludinājumu saites");
    for (const ln of links) drawParagraph(ctx, ln, 9);
  }

  drawFooter(ctx);
  const bytes = await ctx.pdfDoc.save();
  return bytes;
}

const MAX_OFFER_IMAGES = 3;
const MAX_RAW_IMAGE_BYTES = 1_200_000;
const MAX_IMAGE_DRAW_W = 400;
const MAX_IMAGE_DRAW_H = 200;

export type BuildIrissOfferPdfOptions = {
  /** `false` — tikai teksts (stabilitātei / diagnostikai). API: `?images=0`. */
  embedImages?: boolean;
};

export async function buildIrissOfferPdfBytes(
  record: IrissPasutijumsRecord,
  offer: IrissOfferRecord,
  opts?: BuildIrissOfferPdfOptions,
): Promise<Uint8Array> {
  const embedImages = opts?.embedImages !== false;
  const ctx = await createPdfCtx();
  const title = offer.title.trim() || "Piedāvājums";

  drawTextLine(ctx, title, 16, { font: ctx.fontBold, color: ACCENT });
  drawParagraph(ctx, new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date()), 9, MUTED);
  ctx.y -= 8;

  drawSectionTitle(ctx, "Klienta dati");
  const clientName = `${record.clientFirstName} ${record.clientLastName}`.trim() || "—";
  drawParagraph(ctx, `Klients: ${clientName}`, 10);
  drawParagraph(ctx, `Tālrunis: ${record.phone.trim() || "—"}`, 10);
  drawParagraph(ctx, `E-pasts: ${record.email.trim() || "—"}`, 10);

  drawSectionTitle(ctx, "Piedāvājuma dati");
  drawParagraph(ctx, `Marka/modelis: ${offer.brandModel.trim() || "—"}`, 10);
  drawParagraph(ctx, `Gads: ${offer.year.trim() || "—"}`, 10);
  drawParagraph(ctx, `Nobraukums: ${offer.mileage.trim() || "—"}`, 10);
  drawParagraph(ctx, `Cena Vācijā: ${offer.priceGermany.trim() || "—"}`, 10);

  drawSectionTitle(ctx, "Komentāri");
  drawParagraph(ctx, offer.comment.trim() || "—", 10);

  const imageAttachments = offer.attachments.filter(
    (a) => a.mimeType.startsWith("image/") && a.dataUrl.startsWith("data:image/"),
  );
  const other = offer.attachments.filter((a) => !imageAttachments.includes(a));

  if (!embedImages && imageAttachments.length > 0) {
    drawSectionTitle(ctx, "Pievienotie attēli");
    drawParagraph(ctx, "Attēli šajā eksportā nav iekļauti (ātrs PDF bez attēliem).", 9, MUTED);
  } else if (embedImages && imageAttachments.length > 0) {
    drawSectionTitle(ctx, "Pievienotie attēli");
    let count = 0;
    for (const att of imageAttachments) {
      if (count >= MAX_OFFER_IMAGES) {
        drawParagraph(ctx, `… vēl ${imageAttachments.length - MAX_OFFER_IMAGES} attēli nav iekļauti (maks. ${MAX_OFFER_IMAGES} PDF saturā).`, 9, MUTED);
        break;
      }
      const raw = tryParseImageDataUrlToBuffer(att.dataUrl);
      if (!raw || raw.byteLength > MAX_RAW_IMAGE_BYTES) {
        drawParagraph(ctx, `Attēls pārāk liels vai nederīgs: ${att.name}`, 9, MUTED);
        continue;
      }
      const shrunk = await shrinkImageBytesForIrissPdf(raw);
      if (!shrunk) {
        drawParagraph(ctx, `Neizdevās apstrādāt attēlu: ${att.name}`, 9, MUTED);
        continue;
      }
      try {
        const embedded = await ctx.pdfDoc.embedJpg(shrunk);
        const iw = embedded.width;
        const ih = embedded.height;
        const scale = Math.min(MAX_IMAGE_DRAW_W / iw, MAX_IMAGE_DRAW_H / ih, 1);
        const dw = iw * scale;
        const dh = ih * scale;
        ensureSpace(ctx, dh + lineHeight(9) + 16);
        ctx.page.drawImage(embedded, {
          x: ctx.margin,
          y: ctx.y - dh,
          width: dw,
          height: dh,
        });
        ctx.y -= dh + 4;
        drawParagraph(ctx, att.name, 8, MUTED);
        count += 1;
      } catch {
        drawParagraph(ctx, `Nevarēja iekļaut attēlu: ${att.name}`, 9, MUTED);
      }
    }
  }

  if (other.length > 0) {
    drawSectionTitle(ctx, "Citi faili");
    for (let i = 0; i < other.length; i++) {
      drawParagraph(ctx, `${i + 1}. ${other[i].name}`, 9);
    }
  } else if (imageAttachments.length === 0) {
    drawSectionTitle(ctx, "Pievienotie faili");
    drawParagraph(ctx, "Faili nav pievienoti.", 9, MUTED);
  }

  drawFooter(ctx);
  return ctx.pdfDoc.save();
}
