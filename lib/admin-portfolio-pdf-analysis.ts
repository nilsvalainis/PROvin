/**
 * Portfeļa PDF teksta izvilkšana (pdf.js) un heuristiska analīze: nobraukums, brīdinājumi.
 */

import { extractClaimRowsForPdfInsight, type ClaimTableRow } from "@/lib/claim-rows-parse";

export type KmSample = {
  km: number;
  /** Datums vai konteksta fragments, ja izdevies izvilkt */
  context?: string;
};

/**
 * Heuristiska klase pēc faila nosaukuma un PDF teksta — klienta PDF tiek lietots neitrāls nosaukums.
 * Kartē uz biežāk lietotajiem starptautisko vēstures pārskatu formātiem.
 */
export type HistoryPdfKind = "euro_network" | "regional_alt" | "registry_focus" | "generic";

export const HISTORY_PDF_KIND_LABEL_LV: Record<HistoryPdfKind, string> = {
  euro_network: "Platās Eiropas datu bāzes pārskats",
  regional_alt: "Papildu starptautiskā pārskata formāts",
  registry_focus: "Reģistra / valsts uzsvara pārskats",
  generic: "Vēstures PDF (tips nav klasificēts)",
};

/** Noteikšana pēc faila un teksta (nav juridiski saistīta ar izdevēju; tikai kopsavilkuma grupēšanai). */
export function detectHistoryPdfKind(fileName: string, text: string): HistoryPdfKind {
  const f = fileName.toLowerCase();
  const t = text.slice(0, 120_000).toLowerCase();
  const hay = `${f}\n${t}`;
  if (/car[\s_-]*vertical|carvertical/i.test(hay)) return "euro_network";
  if (/auto[\s_-]*records|autorecords/i.test(hay)) return "registry_focus";
  if (/auto[\s_-]*dna|autodna/i.test(hay)) return "regional_alt";
  return "generic";
}

export type PdfPortfolioFileInsight = {
  fileName: string;
  /** Klienta atskaitē: 1, 2, 3… (nav faila nosaukuma). */
  sourceOrdinal: number;
  charCount: number;
  kmSamples: KmSample[];
  /** Īsi secinājumi / atslēgvārdi */
  highlights: string[];
  historyKind: HistoryPdfKind;
  /** Atlīdzības / tāmes rindas, izvilktas no PDF teksta. */
  claimRows: ClaimTableRow[];
  /** Cik lapas lasītas ar OCR, ja teksta slānis bija pārāk mazs (bieži — skenēts PDF). */
  ocrPages?: number;
};

/** Mazāk par šo — pārlūkā mēģinām OCR pirmās dažas lapas (tikai `window`; serverī netiek lietots). */
const OCR_TEXT_CHARS_THRESHOLD = 420;
const OCR_MAX_PAGES = 4;

function nonWhitespaceCharCount(s: string): number {
  return s.replace(/\s/g, "").length;
}

const LV_LETTER_CLASS = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";

/**
 * Daži izdevēju PDF (piem. carVertical) dod katru burtu/ciparu kā atsevišķu virknes elementu →
 * „2 9 9 5 1 9 k m”. Sakļaujam, lai strādātu nobraukuma un atslēgvārdu meklēšana.
 */
function normalizePdfExtractedText(raw: string): string {
  let t = raw.replace(/\u00a0/g, " ");
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/(\d)\s+(?=\d)/g, "$1");
  }
  t = t.replace(/\b([kK])\s+([mM])\b/g, "$1$2");
  const re = new RegExp(`\\b([${LV_LETTER_CLASS}])(?:\\s+([${LV_LETTER_CLASS}])){2,}\\b`, "g");
  for (let i = 0; i < 12; i++) {
    t = t.replace(re, (chunk) => chunk.replace(/\s+/g, ""));
  }
  return t;
}

const ACCIDENT_HINTS: { re: RegExp; label: string }[] = [
  { re: /\bnegad[īi]jums\b/i, label: "Negadījums (atslēgvārds)" },
  { re: /\bav[āa]rija\b/i, label: "Avārija" },
  { re: /\bcollision\b/i, label: "Collision" },
  { re: /\bdamage\b/i, label: "Damage" },
  { re: /\baccident\b/i, label: "Accident" },
  { re: /\btotal\s*loss\b/i, label: "Total loss" },
  { re: /\bmileage\s*rollback\b/i, label: "Mileage rollback" },
  { re: /\bodometer\s*(fraud|tamper)/i, label: "Odometer tampering" },
  { re: /\bmanipul[āa]cij/i, label: "Manipulācija (tekstā)" },
  { re: /\br[ūu]pn[īi]cas\s*atsauk/i, label: "Rūpnīcas atsaukums" },
  { re: /\brecall\b/i, label: "Recall" },
];

const KM_WITH_DATE_RE =
  /(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})[^\d]{0,180}?(\d{1,3}(?:[ \u00a0]?\d{3})+)\s*km/gi;
const KM_THEN_DATE_RE =
  /(\d{1,3}(?:[ \u00a0]?\d{3})+)\s*km[^\d]{0,140}?(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/gi;
const KM_PLAIN_RE = /(\d{1,3}(?:[ \u00a0]?\d{3})+)\s*km/gi;
const ODOMETER_EN = /\bodometer\b[^\d]{0,40}?(\d{5,7})\b/gi;
const ODOMETER_LV = /odometra\s+r[aā]d[īi]jums[:\s]+(\d{5,7})/gi;
const MILEAGE_EN = /(?:recorded\s+)?mileage[:\s]+(\d{5,7})\b/gi;
const ODO_READING_EN = /odometer\s+reading[:\s]+(\d{5,7})\b/gi;

function pushKmUnique(arr: KmSample[], km: number, context?: string) {
  if (km < 1000 || km > 2_000_000) return;
  if (arr.some((x) => Math.abs(x.km - km) < 2)) return;
  arr.push({ km, context });
}

function extractKmSamples(text: string): KmSample[] {
  const out: KmSample[] = [];
  let m: RegExpExecArray | null;
  const t = text.replace(/\u00a0/g, " ");

  while ((m = KM_WITH_DATE_RE.exec(t)) !== null) {
    const km = parseInt(m[2].replace(/\s/g, ""), 10);
    pushKmUnique(out, km, m[1]);
  }
  KM_WITH_DATE_RE.lastIndex = 0;

  while ((m = KM_THEN_DATE_RE.exec(t)) !== null) {
    const km = parseInt(m[1].replace(/\s/g, ""), 10);
    pushKmUnique(out, km, m[2]);
  }
  KM_THEN_DATE_RE.lastIndex = 0;

  while ((m = KM_PLAIN_RE.exec(t)) !== null) {
    const km = parseInt(m[1].replace(/\s/g, ""), 10);
    pushKmUnique(out, km);
  }

  while ((m = ODOMETER_EN.exec(t)) !== null) {
    pushKmUnique(out, parseInt(m[1], 10), "odometer");
  }
  while ((m = ODOMETER_LV.exec(t)) !== null) {
    pushKmUnique(out, parseInt(m[1], 10), "odometra rādījums");
  }
  while ((m = MILEAGE_EN.exec(t)) !== null) {
    pushKmUnique(out, parseInt(m[1], 10), "mileage");
  }
  while ((m = ODO_READING_EN.exec(t)) !== null) {
    pushKmUnique(out, parseInt(m[1], 10), "odometer reading");
  }

  return out.sort((a, b) => a.km - b.km);
}

function extractHighlights(text: string): string[] {
  const found = new Set<string>();
  const t = text.slice(0, 400_000);
  for (const { re, label } of ACCIDENT_HINTS) {
    re.lastIndex = 0;
    if (re.test(t)) found.add(label);
  }
  return [...found];
}

async function extractPdfTextWithOptionalOcr(buffer: ArrayBuffer): Promise<{ text: string; ocrPages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjs.getDocument({ data: buffer, useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((item) => {
        if (item && typeof item === "object" && "str" in item && typeof (item as { str: string }).str === "string") {
          return (item as { str: string }).str;
        }
        return "";
      })
      .join(" ");
    parts.push(line);
  }
  let text = normalizePdfExtractedText(parts.join("\n"));
  let ocrPages = 0;

  const needOcr =
    typeof window !== "undefined" &&
    nonWhitespaceCharCount(text) < OCR_TEXT_CHARS_THRESHOLD &&
    pdf.numPages > 0;

  if (needOcr) {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+lav", undefined, {
        logger: () => undefined,
      });
      try {
        const maxP = Math.min(OCR_MAX_PAGES, pdf.numPages);
        const ocrChunks: string[] = [];
        const maxSide = 1900;
        for (let p = 1; p <= maxP; p++) {
          const page = await pdf.getPage(p);
          const base = page.getViewport({ scale: 1 });
          let scale = 2;
          if (base.width * scale > maxSide) scale = maxSide / base.width;
          if (base.height * scale > maxSide) scale = Math.min(scale, maxSide / base.height);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) break;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const task = page.render({ canvasContext: ctx, viewport });
          await task.promise;
          const { data } = await worker.recognize(canvas);
          if (data.text?.trim()) ocrChunks.push(data.text.trim());
          ocrPages++;
        }
        if (ocrChunks.length) {
          const merged = [text, ...ocrChunks].filter((s) => nonWhitespaceCharCount(s) > 0);
          text = merged.join("\n");
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      /* OCR neizdevās — atstājam tikai teksta slāņa rezultātu */
    }
  }

  text = normalizePdfExtractedText(text);
  return { text, ocrPages };
}

/** Teksta slānis caur pdf.js; pārlūkā — papildu OCR, ja teksts īss (bieži skenēti PDF). */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { text } = await extractPdfTextWithOptionalOcr(buffer);
  return text;
}

export async function analyzePdfBuffer(
  fileName: string,
  buffer: ArrayBuffer,
  sourceOrdinal: number,
): Promise<PdfPortfolioFileInsight> {
  let text = "";
  let ocrPages = 0;
  try {
    const r = await extractPdfTextWithOptionalOcr(buffer);
    text = r.text;
    ocrPages = r.ocrPages;
  } catch {
    return {
      fileName,
      sourceOrdinal,
      charCount: 0,
      kmSamples: [],
      highlights: ["Tekstu neizdevās izvilkt no datnes (bojāts fails vai lasīšanas kļūda)."],
      historyKind: detectHistoryPdfKind(fileName, ""),
      claimRows: [],
    };
  }
  const kmSamples = extractKmSamples(text);
  const baseHighlights = extractHighlights(text);
  const highlights =
    ocrPages > 0
      ? [
          `OCR: automātiski nolasītas ${ocrPages} lapas (trūka teksta slāņa vai vājš teksts). Salīdziniet ar oriģinālu — iespējamas kļūdas.`,
          ...baseHighlights,
        ]
      : baseHighlights;
  const claimRows = extractClaimRowsForPdfInsight(text, sourceOrdinal);
  return {
    fileName,
    sourceOrdinal,
    charCount: text.length,
    kmSamples,
    highlights,
    historyKind: detectHistoryPdfKind(fileName, text),
    claimRows,
    ...(ocrPages > 0 ? { ocrPages } : {}),
  };
}

/** Admin priekšskatam / grafikiem — etiķetes bez failu nosaukumiem. */
export function mergeKmForChart(insights: PdfPortfolioFileInsight[]): { km: number; label: string }[] {
  const merged: { km: number; label: string }[] = [];
  for (const ins of insights) {
    const base = `Pārskats ${ins.sourceOrdinal}`;
    for (const s of ins.kmSamples) {
      const label = s.context ? `${base} · ${s.context}` : base;
      if (merged.some((m) => Math.abs(m.km - s.km) < 50 && m.label.startsWith(base))) continue;
      merged.push({ km: s.km, label });
    }
  }
  return merged.sort((a, b) => a.km - b.km);
}
