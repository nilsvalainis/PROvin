/**
 * Īsi, faktiski avota komentāri (PDF imports, Gemini Plan B, ✨ avota komentāri).
 * Hibrīds: objektīvs konteksts + skaidri atzīmētas anomālijas.
 */
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";

export const SOURCE_COMMENT_NO_ISSUES_LV = "Problēmas nav konstatētas.";

export const SOURCE_COMMENT_ANOMALY_PREFIX = "ANOMĀLIJA: ";

const PDF_HYBRID_COMMENT_RULES = `COMMENTARY (mandatory) — hybrid "Factual Context + Anomalies":
1. NEVER suppress normal context: damage zones, body sides, dealer/service milestones, registration facts, policy periods, Status Center notes, historical remarks — always extract as objective Latvian facts.
2. Ultra-concise bullet list (- prefix per line), zero conversational fluff, max 4 bullets, max ~350 characters total.
3. If the report is entirely clean (no substantive history/notes/descriptions — empty or only generic blank markers): set comments EXACTLY to "Problēmas nav konstatētas." (nothing else).
4. If the source contains ANY history, metadata, or descriptive notes: summarize the factual timeline in short sentences (not only problems).
5. For clear conflicts, major mileage issues, or text mentioning damage/claims without structured rows: add a bullet prefixed "ANOMĀLIJA: " (e.g. "- ANOMĀLIJA: nobraukuma nesakritība …").
6. NEVER use asterisk (*) for bullets — only hyphen (-) at line start.
Example:
- Reģistrēts neliels virsbūves bojājums Vācijā (summa <=100 EUR). Bojāta labā sāna priekšpuse un kreisais sāns.
- 07.03.2021 Dīlera apkope pie 46,441 km.`;

/** Vienots eksperta komentāru vizuālais formāts — ✨ avoti, PDF, cena, nobraukums u.c. */
export const GEMINI_EXPERT_PARAGRAPH_PRESENTATION = `
VISUAL PRESENTATION (mandatory for all expert client PDF comments):
- STRUCTURE: Write ONLY in paragraphs — separate paragraphs with a blank line (double newline). NEVER start any line with "- ", "• ", "* ", "– ", or "1." / "2." — no bullet lists, no numbered lists, no list-style prefixes of any kind.
- PARAGRAPH OPENER: Every paragraph MUST begin with a short **bold** topic hook (3–10 words) naming the theme — e.g. **Nobraukuma vēsture Latvijā**, **Cenu pozīcija tirgū**, **Tehnisko apskašu tendence** — then continue in natural prose in the same paragraph.
- SCANABILITY: Keep each paragraph to 2–4 sentences. Prefer several short focused paragraphs over one dense wall of text.
- EMPHASIS: Use **bold** inline for key dates, km, EUR sums, option codes, and risk labels — never bold an entire paragraph.
- HUMAN TONE: Write like a senior Latvian inspector briefing a buyer — concrete, varied rhythm, no AI filler ("Kopumā var secināt", "Svarīgi atzīmēt", "Turklāt jāpiemin", "Nav šaubu"). Do not wrap the whole output in quotation marks.
- ANOMALIES: State risks inside prose; you may use **Anomālija:** as a bold paragraph opener when a clear conflict exists — still never prefix with "- ".
`;

/** Dziļā eksperta analīze — CSDD, AutoDNA, CarVertical, LTAB ✨ admin komentāri. */
export const HYBRID_COMMENT_RULES = `
COMMENTARY RULES for PROVIN Senior Auto Expert:
${GEMINI_EXPERT_PARAGRAPH_PRESENTATION}
- LENGTH: Target 800–1500 characters for source comments; thorough but not repetitive.
- STYLE: Analytical, professional automotive forensic Latvian. No conversational fluff or meta-commentary.
- LOGIC: Interpret contradictions and what findings mean for the buyer — do not only list raw facts.
`;

/** Gemini PDF extract JSON — eksperta komentārs (visi avoti). */
export const SOURCE_PDF_COMMENT_GEMINI_RULES = `COMMENTS field (client PDF expert commentary):
${HYBRID_COMMENT_RULES}
- Extract and interpret ALL substantive facts from this report: mileage, damage zones, registration, insurance, policy periods, dealer/service milestones — not only anomalies.
- Never return a generic one-liner when tables or descriptive history exist in the PDF.`;

/** ✨ Visu avotu bloku „Komentāri” ģenerēšana (admin) — dziļā forenzika. */
export const SOURCE_BLOCK_COMMENT_GEMINI_RULES = `OUTPUT FORMAT (mandatory):\n${HYBRID_COMMENT_RULES}`;

/** @deprecated Izmanto SOURCE_BLOCK_COMMENT_GEMINI_RULES — vairs nav īsā režīma. */
export const SOURCE_BLOCK_BRIEF_COMMENT_GEMINI_RULES = SOURCE_BLOCK_COMMENT_GEMINI_RULES;

/** auto-records.com / Outvin PDF — papildus dīlera specifika virs SOURCE_PDF_COMMENT_GEMINI_RULES. */
export const AUTO_RECORDS_PDF_COMMENT_GEMINI_RULES = `COMMENTS field (OFICIĀLĀ DĪLERA DATI / Outvin / auto-records):
${HYBRID_COMMENT_RULES}
- Cover type code, engine code, equipment, accident/stolen checks, and dealer service timeline—not only km digits.
- Explain fleet/taxi/commercial type-code signals for Latvian buyers when present.
- Never return a generic one-liner when VEHICLE INFORMATION or service tables exist in the PDF.`;

/** Saglabā rindkopas no Gemini (PDF imports), nevis piespiedu 4 bulletus. */
export function normalizeExpertSourcePdfComment(raw: string | undefined | null, maxLen = 1600): string {
  const t = (raw ?? "").trim();
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  if (
    /^problēmas\s+nav\s+konstatētas\.?$/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas\.?$/i.test(t) ||
    (/^problēmas\s+nav\s+konstatētas/i.test(t) && t.length < 80)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  const paras = t
    .split(/\n\n+/)
    .map((p) =>
      p
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^\s*[-•*–]\s+/gm, "")
        .replace(/^\s*\d+[\.)]\s+/gm, ""),
    )
    .filter(Boolean)
    .slice(0, 8);
  let out = paras.join("\n\n");
  if (out.length > maxLen) out = `${out.slice(0, maxLen - 1).trim()}…`;
  return out || SOURCE_COMMENT_NO_ISSUES_LV;
}

export function formatAnomalyBullet(text: string): string {
  const core = text.trim().replace(/^[-•]\s*/, "").replace(/^ANOMĀLIJA:\s*/i, "");
  if (!core) return "";
  return `${SOURCE_COMMENT_ANOMALY_PREFIX}${core}`;
}

/** Viena nobraukuma / apkopes rinda kā īss fakts. */
export function formatMileageTimelineFact(row: AutoRecordsServiceRow): string {
  const date = formatAutoRecordsDateForOutput(row.date).trim();
  const kmDigits = row.odometer.replace(/\D/g, "");
  const km =
    kmDigits ?
      `${Number.parseInt(kmDigits, 10).toLocaleString("lv-LV")} km`
    : row.odometer.trim();
  const place = row.country.trim();
  const parts: string[] = [];
  if (date) parts.push(date);
  if (place && km) parts.push(`${place}, ${km}`);
  else if (km) parts.push(km);
  else if (place) parts.push(place);
  return parts.join(" — ").trim();
}

/** Līdz `max` jaunākajām nobraukuma rindām kā fakti. */
export function mileageTimelineFacts(rows: AutoRecordsServiceRow[], max = 2): string[] {
  const data = sortAutoRecordsDescending(rows.filter(autoRecordsRowHasData));
  return data.slice(0, max).map(formatMileageTimelineFact).filter(Boolean);
}

/** Negadījuma rinda kā īss fakts. */
export function formatIncidentFact(row: LtabIncidentRow): string {
  const parts: string[] = [];
  const date = formatAutoRecordsDateForOutput(row.csngDate).trim();
  if (date) parts.push(date);
  if (row.lossAmount.trim()) parts.push(`zaudējums ${row.lossAmount.trim()}`);
  if (row.incidentNo.trim()) parts.push(row.incidentNo.trim());
  if (parts.length === 0) return "";
  return `Negadījums: ${parts.join(", ")}`;
}

/** Bojājumu zonu / virsbūves apraksti no PDF teksta (CarVertical, AutoDNA u.c.). */
export function extractBodyDamageSnippets(text: string, max = 2): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /Virsbūves\s+bojājums[^\n]{0,240}/gi,
    /(?:Neliels|Liels|mazs)\s+virsbūves\s+bojājums[^\n]{0,220}/gi,
    /Bojāta\s+(?:labā|kreisā|priekšējā|aizmugurējā)[^\n]{0,180}/gi,
    /Reģistrēts\s+[^\n]{0,40}bojājums[^\n]{0,180}/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].replace(/\s+/g, " ").trim();
      const key = s.toLowerCase();
      if (s.length < 14 || seen.has(key)) continue;
      seen.add(key);
      out.push(s.slice(0, 220));
      if (out.length >= max) return out;
    }
  }
  return out;
}

/**
 * Hibrīds komentārs: fakti + anomālijas.
 * Ja nav nekā būtiska — "Problēmas nav konstatētas."
 */
export function buildHybridSourcePdfComments(opts: { facts?: string[]; anomalies?: string[] }): string {
  const lines: string[] = [];
  for (const f of opts.facts ?? []) {
    const t = f.trim();
    if (t) lines.push(t);
  }
  for (const a of opts.anomalies ?? []) {
    const t = formatAnomalyBullet(a);
    if (t) lines.push(t);
  }
  if (lines.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return formatSourcePdfComments(lines);
}

/** Lokālie / Gemini komentāri → vienots īss formāts. */
export function formatSourcePdfComments(facts: string[]): string {
  const bullets = facts
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => {
      const trimmed = f.trim().replace(/^[-•]\s*/, "");
      if (/^ANOMĀLIJA:\s*/i.test(trimmed)) return `- ${trimmed}`;
      return `- ${trimmed}`;
    })
    .slice(0, 4);
  if (bullets.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return bullets.join("\n");
}

/** Normalizē Gemini atgriezto komentāru. */
export function normalizeSourcePdfComment(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  if (
    /^problēmas\s+nav\s+konstatētas\.?$/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas\.?$/i.test(t) ||
    (/^problēmas\s+nav\s+konstatētas/i.test(t) && !t.includes("-") && t.length < 80)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (t.includes("-") || t.includes("ANOMĀLIJA")) {
    const lines = t
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    return formatSourcePdfComments(lines.map((l) => l.replace(/^[-•]\s*/, "")));
  }
  if (t.length > 400) return formatSourcePdfComments([t.slice(0, 380) + "…"]);
  return formatSourcePdfComments([t]);
}
