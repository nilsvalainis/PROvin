import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

import { computeDzintarzemeTame, type DzintarzemeTameInput } from "@/lib/dzintarzeme-tame-calculator";
import {
  drawDzintarzemePdfFooter,
  drawFittedOneLine,
  drawSectionCardWithShadow,
  drawSectionHeadInCard,
  drawTrackedText,
  FOOTER_BLOCK_H,
  INK,
  lineHeight,
  loadOfferLogoPack,
  MUTED,
  SEC_CARD_FILL,
  SEC_HEAD,
  SECTION_GAP,
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
  const floorY = ctx.margin + FOOTER_BLOCK_H;
  const page = ctx.page;

  const footerLogo: LogoPack | null = await loadOfferLogoPack(ctx.pdfDoc);

  const docTitle = "AUTOMAŠĪNAS PASŪTĪJUMA IZMAKASU TĀME";
  const dateStr = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());

  reserveVertical(ctx, lineHeight(11) + lineHeight(8) + 14, floorY);
  const titleUsedH = drawFittedOneLine(
    page,
    docTitle,
    ctx.fontBold,
    ctx.margin,
    ctx.y,
    ctx.contentW,
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

  drawDzintarzemePdfFooter(
    { page: ctx.page, margin: ctx.margin, font: ctx.font, fontBold: ctx.fontBold },
    footerLogo,
  );

  return ctx.pdfDoc.save();
}

export const generateDzintarzemeTame = generateDzintarzemeTamePdfBytes;
