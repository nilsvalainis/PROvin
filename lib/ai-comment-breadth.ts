/**
 * FLASH MAX komentāra platums — operators izvēlas, cik plaši rakstīt.
 * Noklusējums: kopsavilkuma trio plašs, pārējie kompakti (ikdienas stils).
 */

export const COMMENT_BREADTH_LEVELS = ["compact", "standard", "wide"] as const;
export type CommentBreadth = (typeof COMMENT_BREADTH_LEVELS)[number];

export const COMMENT_BREADTH_LABELS: Record<CommentBreadth, string> = {
  compact: "Kompakts",
  standard: "Vidējs",
  wide: "Plašs",
};

export const COMMENT_BREADTH_SHORT: Record<CommentBreadth, string> = {
  compact: "Komp",
  standard: "Vid",
  wide: "Plašs",
};

const BREADTH_PROMPT_RE = /Komentāra platums[^:\n]*:\s*(KOMPAKTS|VIDĒJS|PLAŠS)/i;

export function isCommentBreadth(v: unknown): v is CommentBreadth {
  return v === "compact" || v === "standard" || v === "wide";
}

export function parseCommentBreadth(raw: unknown): CommentBreadth | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (t === "compact" || t === "kompakts" || t === "min") return "compact";
  if (t === "standard" || t === "vidējs" || t === "videjs" || t === "mid") return "standard";
  if (t === "wide" || t === "plašs" || t === "plass" || t === "max") return "wide";
  return null;
}

export function parseCommentBreadthFromPrompt(prompt: string | undefined | null): CommentBreadth | null {
  const m = (prompt ?? "").match(BREADTH_PROMPT_RE);
  if (!m) return null;
  const token = m[1]!.toUpperCase();
  if (token === "KOMPAKTS") return "compact";
  if (token === "VIDĒJS") return "standard";
  return "wide";
}

const SUMMARY_WIDE_JOB_IDS = new Set(["technical_risks", "inspection", "summary"]);

/** Kopsavilkuma tabula (1./2./3.) pēc noklusējuma plaša; pārējie kompaktā ikdienas garumā. */
export function defaultFlashMaxJobBreadth(jobId: string): CommentBreadth {
  const base = jobId.includes(":") ? jobId.slice(0, jobId.indexOf(":")) : jobId;
  return SUMMARY_WIDE_JOB_IDS.has(base) ? "wide" : "compact";
}

export function isFlashMaxSummaryBreadthJob(jobId: string): boolean {
  const base = jobId.includes(":") ? jobId.slice(0, jobId.indexOf(":")) : jobId;
  return SUMMARY_WIDE_JOB_IDS.has(base);
}

const BREADTH_LV: Record<CommentBreadth, string> = {
  compact: "KOMPAKTS",
  standard: "VIDĒJS",
  wide: "PLAŠS",
};

const BREADTH_RULES: Record<CommentBreadth, string[]> = {
  compact: [
    "Ikdienas stils: 1 īsa rindkopa, ja pietiek; maksimums 2.",
    "Tikai šī avota / lauka būtiskie fakti. Bez atkārtošanās un bez vispārīgiem teikumiem.",
    "Avota komentārs: aptuveni 350-800 rakstzīmes.",
  ],
  standard: [
    "Vidējs platums: 1 rindkopa, ja pietiek; 2-3, ja dati to prasa.",
    "Izskaidro svarīgos faktus, bet neraidi eseju.",
    "Avota komentārs: aptuveni 800-1800 rakstzīmes.",
  ],
  wide: [
    "Plašs: garums seko visiem iegūtajiem faktiem. Vairākas rindkopas, nesaīsini.",
    "Kopsavilkuma laukos drīkst būt pilna aina, ne tikai viena rinda.",
    "Avota komentārs: tehniskais griests paliek 4000 rakstzīmes (runaway, ne kvota).",
  ],
};

export function buildCommentBreadthBrief(breadth: CommentBreadth): string {
  return [
    `### Komentāra platums (FLASH MAX): ${BREADTH_LV[breadth]}`,
    ...BREADTH_RULES[breadth].map((line) => `- ${line}`),
  ].join("\n");
}

export function sourceCommentLengthLineForBreadth(
  breadth: CommentBreadth | null,
  isDealerComments: boolean,
): string {
  if (isDealerComments) {
    return "Garums: nav fiksētu griestu šai sadaļai - izskaidro VISUS iegūtos datus (agregātu identifikācija, servisa/remontu vēsture, nobraukuma saskaņa), īpaši, ja tie satur daudz vērtīgas informācijas. Bez liekvārdības un mākslīgi paplašinātiem teikumiem: īss fakts ir labāks par izdomātu teikumu. Katrai lomai virsraksts savā rindā, tad tukša rinda, tad rindkopa; nākamo virsrakstu nekad nelīmē pie iepriekšējā teikuma.";
  }
  if (breadth === "compact") {
    return "Garums: KOMPAKTS (FLASH MAX). 1 īsa rindkopa, ja pietiek; maksimums 2. Aptuveni 350-800 rakstzīmes. Neraidi eseju un neatkārto citus avotus.";
  }
  if (breadth === "standard") {
    return "Garums: VIDĒJS (FLASH MAX). 1 rindkopa, ja pietiek; 2-3, ja šis avots dod daudz faktu. Aptuveni 800-1800 rakstzīmes.";
  }
  if (breadth === "wide") {
    return "Garums: PLAŠS (FLASH MAX). Ja datu ir maz - 1 rindkopa; ja šis avots dod daudz faktu - vairākas rindkopas, nesaīsini un neapgraizi. Tehniskais griests 4000. Ja ir OPERATORA IELĪMĒTAIS TEKSTS vai garš esošais melnraksts - griesti NEATTIECAS.";
  }
  return "Garums: ja datu ir maz - **1 rindkopa**; ja šis avots dod daudz faktu - vairākas rindkopas, nesaīsini un neapgraizi. 2–3 / ≈800 attiecas TIKAI uz trūcīgiem datiem bez operatora teksta. Ja ir OPERATORA IELĪMĒTAIS TEKSTS vai garš esošais melnraksts - griesti NEATTIECAS.";
}

const COMPACT_MAX: Record<string, number> = {
  source: 900,
  source_dealer: 1800,
  incidents: 900,
  mileage: 1200,
  generic: 900,
  technical_risks: 3500,
  inspection: 2800,
  summary: 1000,
  seller: 700,
  oil: 1600,
};

const STANDARD_MAX: Record<string, number> = {
  source: 2000,
  source_dealer: 3500,
  incidents: 1400,
  mileage: 1800,
  generic: 1400,
  technical_risks: 8000,
  inspection: 7000,
  summary: 1400,
  seller: 1000,
  oil: 2500,
};

/** Compact/standard cap the quality ceiling; wide keeps the field budget. */
export function commentBreadthMaxChars(field: string, breadth: CommentBreadth, baseMax: number): number {
  if (breadth === "wide") return baseMax;
  const table = breadth === "compact" ? COMPACT_MAX : STANDARD_MAX;
  const cap = table[field] ?? (breadth === "compact" ? 900 : 1400);
  return Math.min(baseMax, cap);
}
