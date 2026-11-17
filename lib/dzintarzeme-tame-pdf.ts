import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { computeDzintarzemeTame, type DzintarzemeTameInput } from "@/lib/dzintarzeme-tame-calculator";
import { irissTameBalanceAfterAdvance } from "@/lib/iriss-advance";
import type { IrissTameCommissionRates } from "@/lib/iriss-tame-commission";
import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";
import {
  drawFittedOneLine,
  drawTrackedText,
  loadOfferLogoPack,
  measureTrackedWidth,
  wrapText,
  type LogoPack,
} from "@/lib/dzintarzeme-pdf-layout";

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

export type DzintarzemeTamePdfOpts = {
  advancePaidEur?: number;
  /** Pasūtījuma numurs galvenē (piem. "P-8BCA"). */
  docNo?: string;
  clientName?: string;
  phone?: string;
  year?: string;
  mileageKm?: string;
  now?: Date;
};

const C_INK = rgb(17 / 255, 24 / 255, 39 / 255);
const C_MUTED = rgb(107 / 255, 114 / 255, 128 / 255);
const C_TEXT2 = rgb(75 / 255, 85 / 255, 99 / 255);
const C_LINE = rgb(229 / 255, 231 / 255, 235 / 255);
const C_BAND = rgb(246 / 255, 246 / 255, 247 / 255);
const C_TOTAL_FILL = rgb(249 / 255, 250 / 255, 251 / 255);
const C_ORANGE = rgb(245 / 255, 134 / 255, 31 / 255);

/** "1 078,00 €" - tūkstošu atstarpe arī 4 cipariem. */
function eur(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} €`;
}

function rigaDate(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}.${p.year}`;
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, "");
  const local = d.length === 11 && d.startsWith("371") ? d.slice(3) : d.length === 8 ? d : "";
  return local ? `+371 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}` : raw.trim();
}

function fmtKmText(raw: string): string {
  const d = raw.replace(/[^\d]/g, "");
  return d ? `${d.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km` : "";
}

/**
 * Dzintarzeme Auto izmaksu tāme - viena A4 lapa pēc apstiprinātā maketa (Nils 28.10):
 * logo + virsraksts, Klients/Automašīna režģis, pozīcijas grupās, kopsavilkums ar atlikumu, pelēka kājene.
 */
export async function generateDzintarzemeTamePdfBytes(
  input: DzintarzemeTameInput,
  rates?: IrissTameCommissionRates,
  opts?: DzintarzemeTamePdfOpts,
): Promise<Uint8Array> {
  const c = computeDzintarzemeTame(input, rates);
  const ctx = await createCtx();
  const { page, font, fontBold, pageW, pageH } = ctx;
  const M = 45;
  const W = pageW - M * 2;
  const right = pageW - M;
  const text = (t: string, x: number, yTop: number, size: number, f: PDFFont = font, color = C_INK) =>
    page.drawText(t, { x, y: pageH - yTop - size * 0.8, size, font: f, color });
  const textR = (t: string, xRight: number, yTop: number, size: number, f: PDFFont = font, color = C_INK) =>
    text(t, xRight - f.widthOfTextAtSize(t, size), yTop, size, f, color);
  const cap = (t: string, x: number, yTop: number) =>
    drawTrackedText(page, t.toUpperCase(), { x, y: pageH - yTop - 6, size: 6.8, font: fontBold, color: C_MUTED, tracking: 0.9 });
  const hline = (x1: number, x2: number, yTop: number, color = C_LINE, thickness = 0.75) =>
    page.drawLine({ start: { x: x1, y: pageH - yTop }, end: { x: x2, y: pageH - yTop }, thickness, color });

  const logo: LogoPack | null = await loadOfferLogoPack(ctx.pdfDoc, { maxW: 120, maxH: 34 });

  // Galvene
  let y = 42;
  if (logo) page.drawImage(logo.img, { x: M, y: pageH - y - logo.dh, width: logo.dw, height: logo.dh });
  textR("Izmaksu tāme", right, y + 2, 16.5, fontBold);
  const sub = [opts?.docNo ? `Nr. ${opts.docNo}` : "", rigaDate(opts?.now ?? new Date())].filter(Boolean).join(" · ");
  textR(sub, right, y + 24, 9, font, C_MUTED);
  y += 34 + 22;

  // Klients / Automašīna režģis
  const cols = [W * (1.25 / 3.5), W * (1.25 / 3.5), W * (1 / 3.5)];
  const cellH = 38;
  const facts: Array<[string, string]> = [
    ["Klients", (opts?.clientName ?? "").trim()],
    ["Automašīna", c.input.brandModel.trim()],
    ["Gads", (opts?.year ?? "").trim()],
    ["Tālrunis", fmtPhone(opts?.phone ?? "")],
    ["VIN", c.input.vin.trim().toUpperCase()],
    ["Nobraukums", fmtKmText(opts?.mileageKm ?? "")],
  ];
  page.drawRectangle({ x: M, y: pageH - y - cellH * 2, width: W, height: cellH * 2, borderColor: C_LINE, borderWidth: 0.75 });
  hline(M, right, y + cellH);
  let cx = M;
  for (let col = 0; col < 3; col++) {
    if (col > 0) page.drawLine({ start: { x: cx, y: pageH - y }, end: { x: cx, y: pageH - y - cellH * 2 }, thickness: 0.75, color: C_LINE });
    for (let row = 0; row < 2; row++) {
      const [label, value] = facts[row * 3 + col]!;
      const top = y + row * cellH + 9;
      cap(label, cx + 12, top);
      drawFittedOneLine(page, value || "-", fontBold, cx + 12, pageH - top - 11, cols[col]! - 24, 9.8, 7, value ? C_INK : C_MUTED, 0);
    }
    cx += cols[col]!;
  }
  y += cellH * 2 + 24;

  // Pozīcijas
  const amountW = 100;
  cap("Pozīcija", M, y);
  const sumCap = "SUMMA";
  drawTrackedText(page, sumCap, { x: right - measureTrackedWidth(sumCap, fontBold, 6.8, 0.9), y: pageH - y - 6, size: 6.8, font: fontBold, color: C_MUTED, tracking: 0.9 });
  y += 13;
  hline(M, right, y, C_INK, 0.75);

  const rows = c.tableRows.filter((r) => r.net > 0);
  const groupOf = (label: string, idx: number) =>
    idx === 0 && c.autoCena > 0 && label === "Automašīnas cena" ? "Automašīna" : /komisij/i.test(label) ? "Komisija" : "Pakalpojumi";
  let lastGroup = "";
  rows.forEach((r, idx) => {
    const g = groupOf(r.label, idx);
    if (g !== lastGroup) {
      y += 11;
      cap(g, M, y);
      y += 10;
      lastGroup = g;
    }
    const subtitle =
      r.label === "Automašīnas cena" && !c.input.applyVatToAutoPrice
        ? "peļņas daļas režīms (PVN likuma 138. pants)"
        : (r.subtitle ?? "").replace("pēc priekšapmaksas", `pēc ${Math.round(c.input.depositPercent)} % priekšapmaksas`);
    const labelLines = wrapText(applyProvinHumanDashes(r.label === "Transporta pakalpojumi" ? "Transports" : r.label), font, 9.4, W - amountW - 10);
    const top = y + 6;
    labelLines.forEach((ln, i) => text(ln, M, top + i * 12, 9.4));
    textR(eur(r.net), right, top, 9.4);
    let h = 6 + labelLines.length * 12;
    if (subtitle) {
      text(subtitle, M, top + labelLines.length * 12 - 1, 7.9, font, C_MUTED);
      h += 10;
    }
    y += h + 4;
    hline(M, right, y);
  });

  // Piezīmes un kopsavilkums
  y += 18;
  const totX = right - 225;
  const notes = [
    "Komisijai un pakalpojumiem piemērots PVN 21 %.",
    "CSDD reģistrācijas un valsts nodevas nav iekļautas - pēc faktiskajām izmaksām.",
    "Aprēķins ir informatīvs un nav rēķins.",
  ];
  const noteW = totX - M - 24;
  let ny = y + 3;
  for (const n of notes) {
    for (const ln of wrapText(n, font, 7.5, noteW)) {
      text(ln, M, ny, 7.5, font, C_MUTED);
      ny += 11;
    }
  }
  const totRow = (label: string, value: string, top: number, size = 9.4, f: PDFFont = font) => {
    text(label, totX, top, size, f);
    textR(value, right, top, size, f);
  };
  let ty = y;
  totRow("Kopā bez PVN", eur(c.summaBezPVN), ty);
  ty += 16;
  totRow("PVN 21 %", eur(c.pvnKopa), ty);
  ty += 16;
  hline(totX, right, ty, C_INK, 0.75);
  ty += 8;
  text("Kopā", totX, ty + 2, 10.5, fontBold);
  textR(eur(c.galaSumma), right, ty, 13.5, fontBold);
  ty += 20;
  const advancePaid = Math.max(0, opts?.advancePaidEur ?? 0);
  if (advancePaid > 0) {
    totRow("Avanss samaksāts", eur(-advancePaid), ty);
    ty += 18;
    const remaining = irissTameBalanceAfterAdvance(c.galaSumma, advancePaid);
    page.drawRectangle({ x: totX, y: pageH - ty - 28, width: right - totX, height: 28, color: C_TOTAL_FILL });
    page.drawRectangle({ x: totX, y: pageH - ty - 28, width: 1.5, height: 28, color: C_ORANGE });
    text("Atlikums apmaksai", totX + 9, ty + 9, 9.8, fontBold);
    textR(eur(remaining), right - 9, ty + 8, 12, fontBold);
  }

  // Kājene: pelēka josla ar oranžu līniju, logo un 3 kolonnas
  const bandH = 78;
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: bandH, color: C_BAND });
  page.drawRectangle({ x: 0, y: bandH - 1.5, width: pageW, height: 1.5, color: C_ORANGE });
  const footLogo = await loadOfferLogoPack(ctx.pdfDoc, { maxW: 90, maxH: 25 });
  if (footLogo) page.drawImage(footLogo.img, { x: M, y: (bandH - footLogo.dh) / 2, width: footLogo.dw, height: footLogo.dh });
  const fcols: Array<[string, string[]]> = [
    ["Adrese", ["Hermaņi 1, Smārdes pag.,", "Tukuma nov., LV-3129"]],
    ["Tālrunis", ["+371 20 420 539", "+371 27 733 440"]],
    ["Kontakti", ["info@dzintarzemeauto.lv", "www.dzintarzemeauto.lv"]],
  ];
  const fx0 = M + 112 + 18;
  const fw = (right - fx0) / 3;
  fcols.forEach(([label, lines], i) => {
    const x = fx0 + i * fw;
    const top = pageH - bandH + 22;
    cap(label, x, top);
    lines.forEach((ln, j) => text(ln, x, top + 11 + j * 11, 7.9, font, C_TEXT2));
  });

  return ctx.pdfDoc.save();
}

export const generateDzintarzemeTame = generateDzintarzemeTamePdfBytes;
