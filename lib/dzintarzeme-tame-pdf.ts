import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

import { computeDzintarzemeTame, type DzintarzemeTameInput } from "@/lib/dzintarzeme-tame-calculator";
import {
  drawRoundedRect,
  drawDzintarzemeTamePdfFooter,
  drawFittedOneLine,
  drawSectionContentFrame,
  drawSectionHeadInCard,
  drawTrackedText,
  INK,
  lineHeight,
  loadOfferLogoPack,
  MUTED,
  measureTrackedWidth,
  SECTION_GAP,
  SECTION_HEAD_GAP,
  TAME_FOOTER_BLOCK_H,
  wrapText,
  type LogoPack,
} from "@/lib/dzintarzeme-pdf-layout";
import {
  drawPremiumInvoiceHeader,
  PREMIUM_HIGHLIGHT_FILL,
  PREMIUM_MUTED as PREMIUM_MUTED_TEXT,
  PREMIUM_ORANGE,
  premiumLineHeight,
} from "@/lib/iriss-premium-pdf-ui";

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

/**
 * Informatīvs atgādinājums (PVN likums, 138.pants — peļņas daļas režīms).
 */
const LV_PVN_TAME_LEGAL_NOTE =
  "Lietotam transportlīdzeklim piemērots PVN likuma 138. panta režīms (peļņas daļas nodoklis). Komisijas maksai un papildu pakalpojumiem piemērota PVN standartlikme 21%. PVN kopsumma norādīta kopsavilkumā.";

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

function reserveVertical(ctx: PdfCtx, need: number, floorY: number): void {
  if (ctx.y - need < floorY) {
    ctx.y = floorY + need;
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

/** Dzintarzeme Auto tāmes PDF — viena A4 lapa, kājene ar logo un kontaktiem. */
export async function generateDzintarzemeTamePdfBytes(input: DzintarzemeTameInput): Promise<Uint8Array> {
  const c = computeDzintarzemeTame(input);
  const ctx = await createCtx();
  const floorY = ctx.margin + TAME_FOOTER_BLOCK_H;
  const page = ctx.page;

  const footerLogo: LogoPack | null = await loadOfferLogoPack(ctx.pdfDoc);

  const docTitle = "PASŪTĪJUMA IZMAKSU APRĒĶINS";
  const dateStr = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());
  const bSub = c.input.brandModel.trim();
  const sublines = [bSub || undefined, dateStr].filter(Boolean) as string[];

  reserveVertical(ctx, 150, floorY);
  const hctx = {
    page,
    pageW: ctx.pageW,
    pageH: ctx.pageH,
    margin: ctx.margin,
    contentW: ctx.contentW,
    font: ctx.font,
    fontBold: ctx.fontBold,
    y: ctx.y,
  };
  drawPremiumInvoiceHeader(hctx, footerLogo, docTitle, sublines, { titleMax: 11, titleMin: 8 });
  ctx.y = hctx.y;

  const innerPad = 10;
  const ix0 = ctx.margin + innerPad;
  const iw = ctx.contentW - innerPad * 2;
  const colRight = ctx.margin + ctx.contentW - innerPad - 2;

  const b = c.input.brandModel.trim();
  const v = c.input.vin.trim();
  const headPas = lineHeight(8.5) + 8;
  const lineBm = b ? lineHeight(9) + 6 : 0;
  const lineVin = v ? lineHeight(8.5) + 6 : 0;
  const frame1H = innerPad + lineBm + lineVin + innerPad;
  reserveVertical(ctx, headPas + SECTION_HEAD_GAP + frame1H + SECTION_GAP, floorY);
  let cy = ctx.y;
  cy -= drawSectionHeadInCard(page, ix0, cy, "PASŪTĪJUMS", ctx.fontBold, PREMIUM_ORANGE);
  cy -= SECTION_HEAD_GAP;
  const f1Top = cy;
  const f1Bot = f1Top - frame1H;
  drawSectionContentFrame(page, { x: ctx.margin, yBottom: f1Bot, w: ctx.contentW, h: frame1H });
  cy = f1Top - innerPad;
  if (b) {
    const line = `Marka / modelis: ${b}`;
    cy -= drawFittedOneLine(page, line, ctx.fontBold, ix0, cy, iw, 9, 7, INK, 0.05) + 2;
  }
  if (v) {
    const line = `VIN: ${v.toUpperCase()}`;
    cy -= drawFittedOneLine(page, line, ctx.fontBold, ix0, cy, iw, 8.5, 7, INK, 0.06) + 2;
  }
  ctx.y = f1Bot - SECTION_GAP;

  const visibleRows = c.tableRows.filter((r) => r.net > 0);
  const labelWrapW = Math.max(120, ctx.contentW - innerPad * 2 - 100);
  const fsRow = 8.5;
  const fsSub = 6.8;
  const lhRow = lineHeight(fsRow);
  const lhSub = lineHeight(fsSub);

  const headIzm = lineHeight(8.5) + 8;
  const hdrRowH = lineHeight(8) + 6;
  let frame2BodyH = innerPad + hdrRowH;
  for (const row of visibleRows) {
    const labelLines = wrapText(row.label, ctx.font, fsRow, labelWrapW);
    const subH = row.subtitle ? lhSub : 0;
    frame2BodyH += Math.max(labelLines.length * lhRow, lhRow) + subH + 5;
  }
  frame2BodyH += innerPad;

  const noteFs = 6;
  const noteLh = premiumLineHeight(noteFs);
  const noteLines = wrapText(LV_PVN_TAME_LEGAL_NOTE, ctx.font, noteFs, iw);
  const noteH = noteLines.length * noteLh;

  reserveVertical(ctx, headIzm + SECTION_HEAD_GAP + frame2BodyH + SECTION_GAP + noteH + SECTION_GAP, floorY);
  cy = ctx.y;
  cy -= drawSectionHeadInCard(page, ix0, cy, "IZMAKSU APRĒĶINS", ctx.fontBold, PREMIUM_ORANGE);
  cy -= SECTION_HEAD_GAP;
  const f2Top = cy;
  const f2Bot = f2Top - frame2BodyH;
  drawSectionContentFrame(page, { x: ctx.margin, yBottom: f2Bot, w: ctx.contentW, h: frame2BodyH });

  cy = f2Top - innerPad;
  drawTrackedText(page, "Apraksts", {
    x: ix0,
    y: cy - 8,
    size: 8,
    font: ctx.fontBold,
    color: MUTED,
    tracking: 0.06,
  });
  const sumH = "SUMMA";
  const nw = measureTrackedWidth(sumH, ctx.fontBold, 8, 0.08);
  drawTrackedText(page, sumH, {
    x: colRight - nw,
    y: cy - 8,
    size: 8,
    font: ctx.fontBold,
    color: MUTED,
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
  ctx.y = f2Bot - SECTION_GAP;

  for (const nl of noteLines) {
    reserveVertical(ctx, noteLh, floorY);
    drawTrackedText(page, nl, {
      x: ix0,
      y: ctx.y - noteFs,
      size: noteFs,
      font: ctx.font,
      color: PREMIUM_MUTED_TEXT,
      tracking: 0.03,
    });
    ctx.y -= noteLh;
  }
  ctx.y -= SECTION_GAP;

  const sumHead = lineHeight(8.5) + 8;
  const sumRowN = lineHeight(9.5) + 6;
  const galaFs = 12;
  const galaLh = premiumLineHeight(galaFs);
  const galaPad = 10;
  const galaBandH = galaLh + galaPad * 2;
  const frame3H = innerPad + sumRowN * 2 + galaBandH + innerPad;

  const disclaimer = "Šis aprēķins ir informatīvs un nav uzskatāms par oficiālu rēķinu.";
  const discLines = wrapText(disclaimer, ctx.font, 7, ctx.contentW - 8);
  const discH = discLines.length * lineHeight(7);

  reserveVertical(ctx, sumHead + SECTION_HEAD_GAP + frame3H + SECTION_GAP + discH + 8, floorY);
  cy = ctx.y;
  cy -= drawSectionHeadInCard(page, ix0, cy, "KOPĒJĀS IZMAKAS", ctx.fontBold, PREMIUM_ORANGE);
  cy -= SECTION_HEAD_GAP;
  const f3Top = cy;
  const f3Bot = f3Top - frame3H;
  drawSectionContentFrame(page, { x: ctx.margin, yBottom: f3Bot, w: ctx.contentW, h: frame3H });

  cy = f3Top - innerPad;
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
    cy -= sumRowN;
  };

  drawSum("Kopā bez PVN (neto bāze)", fmtMoneyEurLv(c.summaBezPVN), false);
  drawSum("PVN 21 %", fmtMoneyEurLv(c.pvnKopa), false);

  const bandTop = cy;
  const bandBot = bandTop - galaBandH;
  drawRoundedRect(page, {
    x: ix0,
    y: bandBot,
    width: iw,
    height: galaBandH,
    radius: 5,
    color: PREMIUM_HIGHLIGHT_FILL,
    borderColor: PREMIUM_ORANGE,
    borderWidth: 1.1,
  });
  const galaVal = fmtMoneyEurLv(c.galaSumma);
  const galaLab = "KOPĀ";
  drawTrackedText(page, galaLab, {
    x: ix0,
    y: bandTop - galaPad - galaFs,
    size: galaFs,
    font: ctx.fontBold,
    color: INK,
    tracking: 0.05,
  });
  const gvw = measureTrackedWidth(galaVal, ctx.fontBold, galaFs, 0.08);
  drawTrackedText(page, galaVal, {
    x: colRight - gvw,
    y: bandTop - galaPad - galaFs,
    size: galaFs,
    font: ctx.fontBold,
    color: INK,
    tracking: 0.08,
  });
  ctx.y = f3Bot - SECTION_GAP;

  for (const ln of discLines) {
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

  drawDzintarzemeTamePdfFooter(ctx.page, ctx.margin, ctx.contentW, ctx.font, ctx.fontBold);

  return ctx.pdfDoc.save();
}

export const generateDzintarzemeTame = generateDzintarzemeTamePdfBytes;
