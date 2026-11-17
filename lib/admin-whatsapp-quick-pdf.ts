/**
 * Vienkāršs WinAnsi-drošs PDF WhatsApp nosūtīšanai (pdf-lib Helvetica).
 * Pilna HTML atskaite - atsevišķi caur „Ģenerēt PDF”.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** CP1252 (WinAnsi) papildu simboli virs ASCII / Latin-1, ko Helvetica var iekodēt. */
const WINANSI_EXTRA = new Set(
  "\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178",
);

/** Biežākie simboli no admin tekstiem, kurus WinAnsi nevar iekodēt (pdf-lib met kļūdu un PDF netiek izveidots). */
const WINANSI_FALLBACK: Record<string, string> = {
  "\u2248": "~",
  "\u2192": "->",
  "\u2190": "<-",
  "\u2191": "^",
  "\u2193": "v",
  "\u2194": "<->",
  "\u21d2": "=>",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2260": "!=",
  "\u2212": "-",
  "\u2011": "-",
  "\u2010": "-",
  "\u2713": "+",
  "\u2714": "+",
  "\u2705": "+",
  "\u2717": "x",
  "\u2718": "x",
  "\u274c": "x",
  "\u26a0": "!",
  "\u2605": "*",
  "\u2606": "*",
  "\u0141": "L",
  "\u0142": "l",
  "\u00a0": " ",
  "\u202f": " ",
  "\u2009": " ",
};

function isWinAnsiChar(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  if (c === 0x0a || c === 0x09) return true;
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0xff) return true;
  return WINANSI_EXTRA.has(ch);
}

export function toWinAnsiSafeText(text: string): string {
  const mapped = text
    .replace(/[Āā]/g, (m) => (m === "Ā" ? "A" : "a"))
    .replace(/[Čč]/g, (m) => (m === "Č" ? "C" : "c"))
    .replace(/[Ēē]/g, (m) => (m === "Ē" ? "E" : "e"))
    .replace(/[Ģģ]/g, (m) => (m === "Ģ" ? "G" : "g"))
    .replace(/[Īī]/g, (m) => (m === "Ī" ? "I" : "i"))
    .replace(/[Ķķ]/g, (m) => (m === "Ķ" ? "K" : "k"))
    .replace(/[Ļļ]/g, (m) => (m === "Ļ" ? "L" : "l"))
    .replace(/[Ņņ]/g, (m) => (m === "Ņ" ? "N" : "n"))
    .replace(/[Ūū]/g, (m) => (m === "Ū" ? "U" : "u"))
    .replace(/[“”„]/g, "\"")
    .replace(/[’]/g, "'");
  let out = "";
  for (const ch of mapped) {
    if (isWinAnsiChar(ch)) out += ch;
    else if (WINANSI_FALLBACK[ch] !== undefined) out += WINANSI_FALLBACK[ch];
    else {
      // Diakritika no citām valodām (ą, ő, ...) - bāzes burts; pārējais (karogi, emoji) - izlaist.
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (base && [...base].every(isWinAnsiChar)) out += base;
    }
  }
  return out;
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
