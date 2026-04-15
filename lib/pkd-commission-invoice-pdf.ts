import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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

export type PkdCommissionInvoiceInput = {
  invoiceNumber: string;
  invoiceDate: string;
  paymentDue: string;
  serviceDescription: string;
  amountEur: string;
  supplierName: string;
  supplierReg: string;
  supplierAddress: string;
  supplierBank: string;
  supplierSwift: string;
  supplierBankAccount: string;
  supplierEmail: string;
  supplierPhone: string;
  recipientCompany: string;
  recipientReg: string;
  recipientAddress: string;
};

const BLACK = rgb(0, 0, 0);
const INK = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.35, 0.35, 0.38);

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
  return Math.round(size * 1.35);
}

function drawCellBox(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  opts?: { fill?: boolean },
) {
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    borderColor: BLACK,
    borderWidth: 0.5,
    color: opts?.fill === false ? undefined : rgb(1, 1, 1),
  });
}

export async function buildPkdCommissionInvoicePdfBytes(input: PkdCommissionInvoiceInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { reg, bold } = await loadInterFontBytes();
  const font = await pdfDoc.embedFont(reg, { subset: true });
  const fontBold = await pdfDoc.embedFont(bold, { subset: true });

  const pageW = 595;
  const pageH = 842;
  const m = 56;
  const contentW = pageW - m * 2;
  const page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - m;

  const title = `RĒĶINS NR. ${input.invoiceNumber.trim()}`;
  const titleSize = 13;
  const tw = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: (pageW - tw) / 2, y: y - titleSize, size: titleSize, font: fontBold, color: INK });
  y -= titleSize + 22;

  const bullet = (label: string) => {
    page.drawText(`• ${label}`, { x: m, y: y - 10, size: 10, font: fontBold, color: INK });
    y -= 14;
  };

  const drawTwoColTable = (rows: { label: string; value: string }[]) => {
    const labelW = contentW * 0.34;
    const valW = contentW - labelW;
    const pad = 6;
    const fs = 9;
    const lh = lineHeight(fs);

    for (const row of rows) {
      const vLines = wrapText(row.value, font, fs, valW - pad * 2);
      const lLines = wrapText(row.label, fontBold, fs, labelW - pad * 2);
      const rowH = Math.max(lLines.length, vLines.length) * lh + pad * 2;

      drawCellBox(page, m, y, labelW, rowH);
      let ly = y - pad - fs;
      lLines.forEach((ln) => {
        page.drawText(ln, { x: m + pad, y: ly, size: fs, font: fontBold, color: INK });
        ly -= lh;
      });

      drawCellBox(page, m + labelW, y, valW, rowH);
      let vy = y - pad - fs;
      vLines.forEach((ln) => {
        page.drawText(ln, { x: m + labelW + pad, y: vy, size: fs, font, color: INK });
        vy -= lh;
      });

      y -= rowH;
    }
    y -= 10;
  };

  bullet("Piegādātājs:");
  drawTwoColTable([
    { label: "Vārds, uzvārds", value: input.supplierName.trim() },
    { label: "Reģ. Nr.", value: input.supplierReg.trim() },
    { label: "Adrese", value: input.supplierAddress.trim() },
    { label: "Banka", value: input.supplierBank.trim() },
    { label: "SWIFT", value: input.supplierSwift.trim() },
    { label: "Bankas konts", value: input.supplierBankAccount.trim() },
    { label: "E-pasts", value: input.supplierEmail.trim() },
    { label: "Tālrunis", value: input.supplierPhone.trim() },
  ]);

  bullet("Saņēmējs:");
  drawTwoColTable([
    { label: "Nosaukums", value: input.recipientCompany.trim() },
    { label: "Reģistrācijas Nr.", value: input.recipientReg.trim() },
    { label: "Adrese", value: input.recipientAddress.trim() },
  ]);

  drawTwoColTable([
    { label: "Rēķina numurs", value: input.invoiceNumber.trim() },
    { label: "Rēķina datums", value: input.invoiceDate.trim() },
    { label: "Apmaksas termiņš", value: input.paymentDue.trim() },
  ]);

  bullet("Pakalpojumu apraksts:");
  const desc = input.serviceDescription.trim();
  const amtRaw = input.amountEur.trim().replace(",", ".");
  const amtNum = Number.parseFloat(amtRaw);
  const amtDisplay = Number.isFinite(amtNum) ? amtNum.toFixed(2) : input.amountEur.trim();

  const c1w = contentW * 0.56;
  const c2w = contentW * 0.22;
  const c3w = contentW - c1w - c2w;
  const hdrH = 22;
  const fs = 9;
  const lh = lineHeight(fs);
  const descLines = wrapText(desc, font, fs, c1w - 12);
  const bodyH = Math.max(descLines.length * lh + 16, 36);

  drawCellBox(page, m, y, c1w, hdrH);
  page.drawText("Apraksts", { x: m + 6, y: y - 6 - fs, size: fs, font: fontBold, color: INK });
  drawCellBox(page, m + c1w, y, c2w, hdrH);
  page.drawText("Summa (EUR)", { x: m + c1w + 4, y: y - 6 - fs, size: fs, font: fontBold, color: INK });
  drawCellBox(page, m + c1w + c2w, y, c3w, hdrH);
  page.drawText("Kopā (EUR)", { x: m + c1w + c2w + 4, y: y - 6 - fs, size: fs, font: fontBold, color: INK });
  y -= hdrH;

  drawCellBox(page, m, y, c1w, bodyH);
  drawCellBox(page, m + c1w, y, c2w, bodyH);
  drawCellBox(page, m + c1w + c2w, y, c3w, bodyH);

  let dy = y - 10 - fs;
  descLines.forEach((ln) => {
    page.drawText(ln, { x: m + 6, y: dy, size: fs, font, color: INK });
    dy -= lh;
  });
  const sumY = y - 10 - fs;
  const amtW2 = font.widthOfTextAtSize(amtDisplay, fs);
  const amtW3 = font.widthOfTextAtSize(amtDisplay, fs);
  page.drawText(amtDisplay, { x: m + c1w + c2w - 4 - amtW2, y: sumY, size: fs, font, color: INK });
  page.drawText(amtDisplay, { x: m + c1w + c2w + c3w - 4 - amtW3, y: sumY, size: fs, font, color: INK });
  y -= bodyH + 14;

  const totalLine = `Kopā maksājams: ${amtDisplay} EUR`;
  const tw2 = fontBold.widthOfTextAtSize(totalLine, 11);
  page.drawText(totalLine, { x: pageW - m - tw2, y: y - 11, size: 11, font: fontBold, color: INK });
  y -= 28;

  const foot1 =
    "PVN netiek piemērots saskaņā ar Pievienotās vērtības nodokļa likuma 3. panta devīto daļu.";
  const foot2 = "Rēķins sagatavots elektroniski un ir derīgs bez paraksta.";
  const fSize = 8;
  for (const ln of wrapText(foot1, font, fSize, contentW * 0.72)) {
    page.drawText(ln, { x: m, y: y - fSize, size: fSize, font, color: MUTED });
    y -= lineHeight(fSize);
  }
  y -= 4;
  const f2w = font.widthOfTextAtSize(foot2, fSize);
  page.drawText(foot2, { x: pageW - m - f2w, y: y - fSize, size: fSize, font, color: MUTED });

  return pdfDoc.save();
}
