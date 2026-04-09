import "server-only";

import fs from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import {
  buildInvoiceServiceLineDescription,
  getInvoicePvnFooterText,
  type InvoiceOrderPayload,
} from "@/lib/generate-invoice-html";
import { formatMoneyEur } from "@/lib/format-money";

const INTER_FILES = path.join(process.cwd(), "node_modules/@fontsource/inter/files");

let font400Cache: Uint8Array | null = null;
let font700Cache: Uint8Array | null = null;

async function loadInterFontBytes(): Promise<{ reg: Uint8Array; bold: Uint8Array }> {
  if (!font400Cache || !font700Cache) {
    const [r, b] = await Promise.all([
      fs.readFile(path.join(INTER_FILES, "inter-latin-ext-400-normal.woff")),
      fs.readFile(path.join(INTER_FILES, "inter-latin-ext-700-normal.woff")),
    ]);
    font400Cache = new Uint8Array(r);
    font700Cache = new Uint8Array(b);
  }
  return { reg: font400Cache, bold: font700Cache };
}

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

const ACCENT = rgb(0 / 255, 97 / 255, 210 / 255);
const INK = rgb(29 / 255, 29 / 255, 31 / 255);
const MUTED = rgb(110 / 255, 110 / 255, 115 / 255);
const LINE = rgb(0.91, 0.91, 0.93);

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

export async function buildInvoicePdfBytes(order: InvoiceOrderPayload): Promise<Uint8Array> {
  const legal = getCompanyLegal();
  const brand = getCompanyPublicBrand();
  const lineDesc = buildInvoiceServiceLineDescription(order);
  const pvnFooter = getInvoicePvnFooterText();
  const money = formatMoneyEur(order.amountTotal, order.currency);
  const email = order.customerEmail ?? order.customerDetailsEmail ?? "—";
  const vin = order.vin?.trim() || "—";
  const invoiceNo = order.invoiceNumber;

  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const invoiceDate = dateFmt.format(new Date(order.created * 1000));

  const pdfDoc = await PDFDocument.create();
  const { reg, bold } = await loadInterFontBytes();
  const font = await pdfDoc.embedFont(reg);
  const fontBold = await pdfDoc.embedFont(bold);

  const pageW = 595;
  const pageH = 842;
  const margin = 48;
  const contentW = pageW - margin * 2;

  const ctx: Ctx = {
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

  drawTextLine(ctx, "RĒĶINS", 11, { font: fontBold, color: MUTED });
  ctx.y -= 2;
  drawTextLine(ctx, brand, 20, { font: fontBold, color: ACCENT });
  ctx.y -= 8;
  drawTextLine(ctx, `Rēķina Nr.: ${invoiceNo}`, 10);
  drawTextLine(ctx, `Datums: ${invoiceDate}`, 10);
  ctx.y -= 10;

  ctx.page.drawLine({
    start: { x: margin, y: ctx.y },
    end: { x: pageW - margin, y: ctx.y },
    thickness: 2,
    color: ACCENT,
  });
  ctx.y -= 24;

  drawTextLine(ctx, "Pakalpojuma sniedzējs", 9, { font: fontBold, color: MUTED });
  if (legal.legalName) drawParagraph(ctx, legal.legalName, 10);
  if (legal.regNo) drawParagraph(ctx, `Reģ. Nr.: ${legal.regNo}`, 10);
  if (legal.legalAddress) drawParagraph(ctx, legal.legalAddress, 10);
  ctx.y -= 8;

  drawTextLine(ctx, "Klients", 9, { font: fontBold, color: MUTED });
  drawParagraph(ctx, `E-pasts: ${email}`, 10);
  drawParagraph(ctx, `Transportlīdzekļa VIN: ${vin}`, 10);
  ctx.y -= 12;

  drawTextLine(ctx, "Preces / pakalpojumi", 9, { font: fontBold, color: MUTED });
  const descMaxW = contentW * 0.5;
  const descLines = wrapText(lineDesc, font, 10, descMaxW);
  const lh10 = lineHeight(10);
  const rowBodyH = Math.max(28, descLines.length * lh10 + 18);
  const rowTotalH = rowBodyH + 22;
  ensureSpace(ctx, rowTotalH + 80);
  const tableTop = ctx.y;
  ctx.page.drawRectangle({
    x: margin,
    y: tableTop - rowTotalH,
    width: contentW,
    height: rowTotalH,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: LINE,
    borderWidth: 1,
  });
  const hPad = 10;
  const tBase = tableTop - 17;
  ctx.page.drawText("Apraksts", { x: margin + hPad, y: tBase, size: 9, font: fontBold, color: MUTED });
  ctx.page.drawText("Daudz.", {
    x: margin + contentW * 0.55,
    y: tBase,
    size: 9,
    font: fontBold,
    color: MUTED,
  });
  ctx.page.drawText("Summa", {
    x: margin + contentW * 0.78,
    y: tBase,
    size: 9,
    font: fontBold,
    color: MUTED,
  });

  const bodyTopY = tableTop - 42;
  let lineY = bodyTopY;
  for (const ln of descLines) {
    ctx.page.drawText(ln, { x: margin + hPad, y: lineY, size: 10, font, color: INK });
    lineY -= lh10;
  }
  const qtyY = bodyTopY;
  ctx.page.drawText("1", {
    x: margin + contentW * 0.55,
    y: qtyY,
    size: 10,
    font,
    color: INK,
  });
  ctx.page.drawText(money, {
    x: margin + contentW * 0.78,
    y: qtyY,
    size: 10,
    font,
    color: INK,
  });

  ctx.y = tableTop - rowTotalH - 8;

  const boxH = 112;
  const boxW = contentW * 0.52;
  const boxLeft = margin + contentW * 0.48;
  ensureSpace(ctx, boxH + 40);
  const sumTop = ctx.y;
  ctx.page.drawRectangle({
    x: boxLeft,
    y: sumTop - boxH,
    width: boxW,
    height: boxH,
    borderColor: LINE,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  const pad = 16;
  let sy = sumTop - 22;
  ctx.page.drawText("Sub Total", { x: boxLeft + pad, y: sy, size: 11, font, color: MUTED });
  ctx.page.drawText(money, {
    x: boxLeft + boxW - pad - font.widthOfTextAtSize(money, 11),
    y: sy,
    size: 11,
    font,
    color: INK,
  });
  sy -= 26;
  ctx.page.drawText("PVN likme", { x: boxLeft + pad, y: sy, size: 10, font, color: MUTED });
  const pvnLab = "0%";
  ctx.page.drawText(pvnLab, {
    x: boxLeft + boxW - pad - font.widthOfTextAtSize(pvnLab, 10),
    y: sy,
    size: 10,
    font,
    color: INK,
  });
  sy -= 30;
  ctx.page.drawText("Total", { x: boxLeft + pad, y: sy, size: 14, font: fontBold, color: INK });
  ctx.page.drawText(money, {
    x: boxLeft + boxW - pad - fontBold.widthOfTextAtSize(money, 14),
    y: sy,
    size: 14,
    font: fontBold,
    color: ACCENT,
  });
  ctx.y = sumTop - boxH - 18;

  drawParagraph(ctx, pvnFooter, 8, MUTED);

  return pdfDoc.save();
}
