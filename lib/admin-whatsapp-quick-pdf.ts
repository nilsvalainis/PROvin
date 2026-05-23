/**
 * Vienkāršs WinAnsi-drošs PDF WhatsApp nosūtīšanai (pdf-lib Helvetica).
 * Pilna HTML atskaite — atsevišķi caur „Ģenerēt PDF”.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export function toWinAnsiSafeText(text: string): string {
  return text
    .replace(/[Āā]/g, "a")
    .replace(/[Čč]/g, "c")
    .replace(/[Ēē]/g, "e")
    .replace(/[Ģģ]/g, "g")
    .replace(/[Īī]/g, "i")
    .replace(/[Ķķ]/g, "k")
    .replace(/[Ļļ]/g, "l")
    .replace(/[Ņņ]/g, "n")
    .replace(/[Šš]/g, "s")
    .replace(/[Ūū]/g, "u")
    .replace(/[Žž]/g, "z")
    .replace(/[“”„]/g, "\"")
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-");
}

function wrapPdfTextLine(text: string, maxWidth: number, widthOfText: (value: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out: string[] = [];
  let line = words[0] ?? "";
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (widthOfText(candidate) <= maxWidth) {
      line = candidate;
    } else {
      out.push(line);
      line = words[i] ?? "";
    }
  }
  out.push(line);
  return out.map((x) => (x.length > 1200 ? `${x.slice(0, 1200)}…` : x));
}

export type WinAnsiQuickPdfSection = { title: string; text: string };

export async function buildWinAnsiQuickPdfFile(args: {
  docHeading: string;
  metaLines: string[];
  sections: WinAnsiQuickPdfSection[];
  filename: string;
}): Promise<File> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const marginX = 44;
  const marginTop = 48;
  const marginBottom = 44;
  const baseSize = 10;
  const lineHeight = 14;
  const titleSize = 14;
  const maxLineWidth = 595 - marginX * 2;
  const widthOfText = (value: string) => font.widthOfTextAtSize(toWinAnsiSafeText(value), baseSize);
  let page = pdf.addPage([595, 842]);
  let y = page.getHeight() - marginTop;
  const ensureSpace = (need: number) => {
    if (y - need > marginBottom) return;
    page = pdf.addPage([595, 842]);
    y = page.getHeight() - marginTop;
  };
  const drawLine = (value: string) => {
    ensureSpace(lineHeight);
    page.drawText(toWinAnsiSafeText(value), {
      x: marginX,
      y,
      size: baseSize,
      font,
      color: rgb(0.11, 0.11, 0.11),
    });
    y -= lineHeight;
  };
  const drawHeading = (value: string) => {
    ensureSpace(22);
    page.drawText(toWinAnsiSafeText(value), {
      x: marginX,
      y,
      size: titleSize,
      font: titleFont,
      color: rgb(0.05, 0.05, 0.05),
    });
    y -= 20;
  };
  const drawParagraph = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      y -= 6;
      return;
    }
    const lines = wrapPdfTextLine(normalized.replace(/\s+/g, " "), maxLineWidth, widthOfText);
    for (const ln of lines) drawLine(ln);
    y -= 4;
  };

  drawHeading(args.docHeading);
  for (const line of args.metaLines) drawParagraph(line);
  drawParagraph("");

  for (const section of args.sections) {
    const body = section.text.trim();
    if (!body) continue;
    drawHeading(section.title);
    const chunks = body.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    for (const chunk of chunks) drawParagraph(chunk);
    y -= 2;
  }

  const pdfBytes = await pdf.save();
  const pdfBlob = new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" });
  return new File([pdfBlob], args.filename, { type: "application/pdf" });
}
