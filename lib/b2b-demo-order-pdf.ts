import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  buildB2bDemoOfferPdfModel,
  buildB2bDemoOrderPdfModel,
  type B2bDemoOrderPdfModel,
} from "@/lib/b2b-demo-order-pdf-html";
import { b2bDemoVatModeLabel, formatB2bDemoMoney } from "@/lib/b2b-demo-order-pricing";
import type { B2bDemoOffer, B2bDemoOrder, B2bDemoSettings } from "@/lib/b2b-demo-types";

const INTER_REG_PATH = path.join(process.cwd(), "public", "fonts", "invoice-inter", "Inter-Regular.ttf");
const INTER_BOLD_PATH = path.join(process.cwd(), "public", "fonts", "invoice-inter", "Inter-Bold.ttf");

const INK = rgb(17 / 255, 24 / 255, 39 / 255);
const MUTED = rgb(51 / 255, 65 / 255, 85 / 255);
const ACCENT = rgb(242 / 255, 101 / 255, 34 / 255);

let fontCache: Promise<{ reg: Uint8Array; bold: Uint8Array }> | null = null;

async function loadInter(): Promise<{ reg: Uint8Array; bold: Uint8Array }> {
  if (!fontCache) {
    fontCache = (async () => {
      const [regBuf, boldBuf] = await Promise.all([fs.readFile(INTER_REG_PATH), fs.readFile(INTER_BOLD_PATH)]);
      return { reg: new Uint8Array(regBuf), bold: new Uint8Array(boldBuf) };
    })();
  }
  return fontCache;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  pageW: number;
  pageH: number;
  margin: number;
  y: number;
};

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < ctx.margin + 36) {
    ctx.page = ctx.doc.addPage([ctx.pageW, ctx.pageH]);
    ctx.y = ctx.pageH - ctx.margin;
  }
}

function drawLine(ctx: Ctx, text: string, size: number, bold = false, color = INK) {
  const font = bold ? ctx.fontBold : ctx.font;
  const lines = wrap(text, font, size, ctx.pageW - ctx.margin * 2);
  for (const line of lines) {
    ensure(ctx, size + 4);
    ctx.page.drawText(line, { x: ctx.margin, y: ctx.y, size, font, color });
    ctx.y -= size + 4;
  }
}

function drawSection(ctx: Ctx, title: string) {
  ensure(ctx, 28);
  ctx.y -= 10;
  ctx.page.drawText(title.toUpperCase(), {
    x: ctx.margin,
    y: ctx.y,
    size: 9,
    font: ctx.fontBold,
    color: ACCENT,
  });
  ctx.y -= 16;
}

function drawKv(ctx: Ctx, label: string, value: string) {
  const labelW = 150;
  const valueW = ctx.pageW - ctx.margin * 2 - labelW;
  const valueLines = wrap(value, ctx.font, 10, valueW);
  const h = Math.max(14, valueLines.length * 13);
  ensure(ctx, h);
  ctx.page.drawText(label, { x: ctx.margin, y: ctx.y, size: 9, font: ctx.fontBold, color: MUTED });
  let y = ctx.y;
  for (const line of valueLines) {
    ctx.page.drawText(line, { x: ctx.margin + labelW, y, size: 10, font: ctx.font, color: INK });
    y -= 13;
  }
  ctx.y -= h;
}

async function renderModel(model: B2bDemoOrderPdfModel): Promise<Uint8Array> {
  const fonts = await loadInter();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fonts.reg, { subset: true });
  const fontBold = await doc.embedFont(fonts.bold, { subset: true });
  const page = doc.addPage([595.28, 841.89]);
  const ctx: Ctx = {
    doc,
    page,
    font,
    fontBold,
    pageW: 595.28,
    pageH: 841.89,
    margin: 40,
    y: 841.89 - 40,
  };
  if (model.party.companyName) drawLine(ctx, model.party.companyName, 12, true);
  drawLine(ctx, model.title, 16, true);
  drawLine(ctx, model.generatedAt, 9, false, MUTED);
  ctx.y -= 8;

  if (model.client.length) {
    drawSection(ctx, "Klients");
    for (const row of model.client) drawKv(ctx, row.label, row.value);
  }
  if (model.vehicle.length) {
    drawSection(ctx, model.kind === "offer" ? "Pamatinformācija" : "Auto");
    for (const row of model.vehicle) drawKv(ctx, row.label, row.value);
  }
  if (model.deal.length) {
    drawSection(ctx, "Darījuma detaļas");
    for (const d of model.deal) drawLine(ctx, `• ${d}`, 10);
  }
  if (model.equipment.length) {
    drawSection(ctx, "Aprīkojums");
    for (const row of model.equipment) drawKv(ctx, row.label, row.value);
  }
  if (model.checks.length || model.assessments.length) {
    drawSection(ctx, "Novērtējums");
    for (const c of model.checks) drawLine(ctx, `${c.on ? "Jā" : "Nē"}: ${c.label}`, 10, c.on);
    for (const row of model.assessments) drawKv(ctx, row.label, row.value);
  }
  if (model.pricing) {
    drawSection(ctx, "Cenas");
    for (const line of model.pricing.lines) drawKv(ctx, line.label, formatB2bDemoMoney(line.amountEur));
    if (model.pricing.vatMode === "standard" && model.pricing.vatEur > 0) {
      drawKv(ctx, b2bDemoVatModeLabel(model.pricing.vatMode), formatB2bDemoMoney(model.pricing.vatEur));
    } else if (model.pricing.vatMode === "margin") {
      drawKv(ctx, b2bDemoVatModeLabel(model.pricing.vatMode), "iekļauts maržā");
    }
    if (model.pricing.totalEur > 0 || model.pricing.lines.length > 0) {
      drawKv(ctx, "Kopā", formatB2bDemoMoney(model.pricing.totalEur));
    }
  }
  if (model.notes) {
    drawSection(ctx, "Piezīmes");
    drawLine(ctx, model.notes, 10);
  }
  if (model.party.termsText) {
    drawSection(ctx, "Noteikumi");
    drawLine(ctx, model.party.termsText, 9, false, MUTED);
  }
  if (model.party.depositText) {
    drawSection(ctx, "Depozīts");
    drawLine(ctx, model.party.depositText, 9, false, MUTED);
  }
  ctx.y -= 12;
  const footer = [
    model.party.companyName,
    model.party.companyReg ? `Reģ. nr.: ${model.party.companyReg}` : "",
    model.party.vatNumber ? `PVN: ${model.party.vatNumber}` : "",
    model.party.address,
    model.party.phone,
    model.party.email,
    model.party.bank,
    model.party.footerText,
  ].filter(Boolean);
  for (const line of footer) drawLine(ctx, line, 8, false, MUTED);
  return doc.save();
}

export async function buildB2bDemoOrderPdfBytes(
  order: B2bDemoOrder,
  settings: B2bDemoSettings,
  opts: { tenantName: string; generatedAt: string },
): Promise<Uint8Array> {
  return renderModel(buildB2bDemoOrderPdfModel(order, settings, opts));
}

export async function buildB2bDemoOfferPdfBytes(
  order: B2bDemoOrder,
  offer: B2bDemoOffer,
  settings: B2bDemoSettings,
  opts: { tenantName: string; generatedAt: string },
): Promise<Uint8Array> {
  return renderModel(buildB2bDemoOfferPdfModel(order, offer, settings, opts));
}
