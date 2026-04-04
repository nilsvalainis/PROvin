/**
 * Portfeļa PDF teksta izvilkšana (pdf.js) un heuristiska analīze: nobraukums, brīdinājumi.
 */

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
  charCount: number;
  kmSamples: KmSample[];
  /** Īsi secinājumi / atslēgvārdi */
  highlights: string[];
  historyKind: HistoryPdfKind;
};

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

const KM_WITH_DATE_RE = /(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})[^\d]{0,120}?(\d{1,3}(?:[ \u00a0]?\d{3})+)\s*km/gi;
const KM_PLAIN_RE = /(\d{1,3}(?:[ \u00a0]?\d{3})+)\s*km/gi;
const ODOMETER_EN = /\bodometer\b[^\d]{0,40}?(\d{5,7})\b/gi;
const ODOMETER_LV = /odometra\s+r[aā]d[īi]jums[:\s]+(\d{5,7})/gi;

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

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
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
  return parts.join("\n");
}

export async function analyzePdfBuffer(fileName: string, buffer: ArrayBuffer): Promise<PdfPortfolioFileInsight> {
  let text = "";
  try {
    text = await extractPdfText(buffer);
  } catch {
    return {
      fileName,
      charCount: 0,
      kmSamples: [],
      highlights: ["PDF tekstu neizdevās izvilkt (bojāts fails vai pdf.js kļūda)."],
      historyKind: detectHistoryPdfKind(fileName, ""),
    };
  }
  const kmSamples = extractKmSamples(text);
  const highlights = extractHighlights(text);
  return {
    fileName,
    charCount: text.length,
    kmSamples,
    highlights,
    historyKind: detectHistoryPdfKind(fileName, text),
  };
}

export function mergeKmForChart(insights: PdfPortfolioFileInsight[]): { km: number; label: string }[] {
  const merged: { km: number; label: string }[] = [];
  for (const ins of insights) {
    for (const s of ins.kmSamples) {
      const label = s.context ? `${ins.fileName} · ${s.context}` : ins.fileName;
      if (merged.some((m) => Math.abs(m.km - s.km) < 50 && m.label.includes(ins.fileName))) continue;
      merged.push({ km: s.km, label });
    }
  }
  return merged.sort((a, b) => a.km - b.km);
}
