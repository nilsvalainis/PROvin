/**
 * CSDD „Smart Paste” — neapstrādāta teksta parsēšana admin laukām.
 */

import type { CsddFormFields, CsddMileageAbroadRow, CsddMileageHistoryRow } from "@/lib/admin-source-blocks";
import { parseDefectRowsFromText, type CsddDefectRow } from "@/lib/csdd-defect-parse";

const LABEL_LINE_RE =
  /^[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž0-9][^:\n]{0,80}:\s*\S/;

/** Rindas, pēc kurām „Nākamās apskates datums” vairs nedrīkst ņemt (vēsturiskās sadaļas / nobraukums). */
const NEXT_INSPECTION_HEAD_BOUNDARY_RES = [
  /^\s*Iepriekšējās\s+apskates\s+dati\b/i,
  /^\s*Nobraukuma\s+vēsture/i,
  /^\s*Nobraukums\s+ārvalst/i,
];

/**
 * Teksts līdz pirmajam vēsturiskās sadaļas / nobraukuma virsrakstam (ieskaitot to neņem).
 * „Nākamās apskates datums” meklē tikai šeit — ne no nobraukuma tabulas, ne no Iepriekšējās apskates.
 */
function sliceTextBeforeNextInspectionHeadBoundary(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!L.trim()) continue;
    for (const re of NEXT_INSPECTION_HEAD_BOUNDARY_RES) {
      if (re.test(L)) return lines.slice(0, i).join("\n");
    }
  }
  return text;
}

/** Teksts pirms pirmā „Iepriekšējās apskates dati” — lai „Detalizētais vērtējums” netiktu ņemts no vēstures bloka. */
function sliceTextBeforeIepriekšējāsApskatesSection(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*Iepriekšējās\s+apskates\s+dati\b/i.test(lines[i].trim())) {
      return lines.slice(0, i).join("\n");
    }
  }
  return text;
}

/** Tikai rindiņa ar atslēgu „Nākamās apskates datums:” augšējā blokā → ISO datums. */
function extractNextInspectionDateIsoFromHead(headText: string): string | null {
  const lines = headText.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/Nākamās\s+apskates\s+datums\s*:\s*(.+)$/i);
    if (!m?.[1]) continue;
    const rest = m[1].trim();
    const dm = rest.match(/\d{2}\.\d{2}\.\d{4}/);
    if (dm) {
      const iso = lvDateToIso(dm[0]);
      return iso || null;
    }
    const isoM = rest.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoM) return `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
  }
  return null;
}

/** „Iepriekšējās apskates datums:” tikai augšējā blokā (ne no vēstures sadaļas). */
function extractPrevInspectionDateIsoFromHead(headText: string): string | null {
  const lines = headText.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/Iepriekšējās\s+apskates\s+datums\s*:\s*(.+)$/i);
    if (!m?.[1]) continue;
    const rest = m[1].trim();
    const dm = rest.match(/\d{2}\.\d{2}\.\d{4}/);
    if (dm) {
      const iso = lvDateToIso(dm[0]);
      return iso || null;
    }
    const isoM = rest.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoM) return `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
  }
  return null;
}

function clipParsedScalar(s: string, max = 240): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Atgāzu cietās daļiņas (cm⁻³) vai dūmainības koeficients (m⁻¹) — pirmā atbilstība.
 */
function extractSolidParticlesOrSmokeCoefficient(text: string): string | null {
  const patterns = [
    /Atgāzu\s+cietās\s+daļiņas\s*(?:\([^)]+\))?\s*:\s*(.+)$/i,
    /Dūmainības\s+koeficients\s*(?:\([^)]+\))?\s*:\s*(.+)$/i,
    /Dūmainības\s+koeficients\s*:\s*(.+)$/i,
  ];
  for (const re of patterns) {
    const v = extractLabeledLine(text, re);
    if (v) return clipParsedScalar(v, 80);
  }
  return null;
}

function isLikelyStructuredCsddPaste(rawText: string): boolean {
  if (rawText.length > 200) return true;
  return (
    /\bIepriekšējās\s+apskates\s+dati\b/i.test(rawText) ||
    /\bNobraukuma\s+vēsture/i.test(rawText) ||
    /\bNobraukums\s+ārvalst/i.test(rawText) ||
    /\bTehniskie\s+dati\b/i.test(rawText) ||
    /\bMarka\s*,\s*modelis\b/i.test(rawText)
  );
}

/** DD.MM.GGGG → YYYY-MM-DD (HTML date input). */
export function lvDateToIso(lv: string): string {
  const t = lv.trim();
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, "");
}

function clipRegNumber(raw: string): string {
  const t = raw.replace(/\s+/g, "").toUpperCase();
  const m = t.match(/^[A-Z0-9]{2,8}$/);
  return m ? m[0] : raw.trim().slice(0, 8);
}

/** Teksts pēc „Marka, modelis:“ līdz nākamajai rindiņai ar atslēgvārdu. */
function extractMakeModel(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => /Marka\s*,\s*modelis\s*:/i.test(l));
  if (idx < 0) return null;
  const first = lines[idx].replace(/^.*Marka\s*,\s*modelis\s*:\s*/i, "").trim();
  const parts: string[] = first ? [first] : [];
  for (let j = idx + 1; j < lines.length; j++) {
    const L = lines[j].trim();
    if (!L) break;
    if (LABEL_LINE_RE.test(L)) break;
    parts.push(L);
  }
  const out = parts.join(" ").replace(/\s+/g, " ").trim();
  return out || null;
}

function extractLabeledLine(text: string, labelRe: RegExp): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(labelRe);
    if (m?.[1] != null) {
      const v = m[1].trim();
      return v || null;
    }
  }
  return null;
}

/** Pirmās reģistrācijas datums: DD.MM.GGGG */
function extractFirstReg(text: string): string | null {
  const v = extractLabeledLine(text, /Pirmās\s+reģistrācijas\s+datums\s*:\s*(.+)$/i);
  if (!v) return null;
  const dm = v.match(/(\d{2}\.\d{2}\.\d{4})/);
  return dm?.[1] ?? null;
}

/** Reģistrācijas numurs: 2–8 simboli */
function extractRegNumber(text: string): string | null {
  const v = extractLabeledLine(text, /Reģistrācijas\s+numurs\s*:\s*(.+)$/i);
  if (!v) return null;
  return clipRegNumber(v);
}

function extractNumericAfterLabel(text: string, labelRe: RegExp): string | null {
  const v = extractLabeledLine(text, labelRe);
  if (!v) return null;
  const d = digitsOnly(v);
  return d || null;
}

/** EUR- uz gadu — summa pirms šī teksta (spec: „EUR- uz gadu”). */
function extractRoadTaxEur(text: string): string | null {
  const normalized = text.replace(/\r/g, "");
  const re = /([\d,\.]+\s*EUR)\s*[-–]\s*uz\s+gadu/gi;
  const m = re.exec(normalized);
  if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  return null;
}

/**
 * „Detalizētais vērtējums:“ / „Novērtējums:“ — teksts pēc pirmā skaitļa rindas sākumā.
 */
function extractRatingBlockAfterDigit(
  lines: string[],
  startIdx: number,
  stripHeaderRe: RegExp,
): string | null {
  const firstLine = lines[startIdx].replace(stripHeaderRe, "").trim();
  const afterNum = firstLine.replace(/^\d+\s*/, "").trim();
  const block: string[] = afterNum ? [afterNum] : [];
  for (let j = startIdx + 1; j < lines.length; j++) {
    const L = lines[j];
    if (!L.trim()) break;
    if (LABEL_LINE_RE.test(L.trim())) break;
    block.push(L.trim());
  }
  return block.join("\n").trim() || null;
}

/** Primāri „Detalizētais vērtējums:”, citādi „Novērtējums:”. Ievadi — tikai teksts pirms „Iepriekšējās apskates dati”. */
function extractDetalizētaisVērtējums(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*Detalizētais\s+vērtējums\s*:/i.test(lines[i])) {
      return extractRatingBlockAfterDigit(lines, i, /^\s*Detalizētais\s+vērtējums\s*:\s*/i);
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*Novērtējums\s*:/i.test(lines[i])) {
      return extractRatingBlockAfterDigit(lines, i, /^\s*Novērtējums\s*:\s*/i);
    }
  }
  return null;
}

function isCsddSectionHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return (
    /^Nobraukuma\s+vēsture/i.test(t) ||
    /^Nobraukums\s+ārvalst/i.test(t) ||
    /^Tehniskie\s+dati/i.test(t) ||
    /^Detalizētais\s+vērtējums/i.test(t) ||
    /^Novērtējums\s*:/i.test(t) ||
    /^Iepriekšējās\s+apskates\s+dati\b/i.test(t) ||
    /^Ceļa\s+nodoklis/i.test(t) ||
    /^Marka\s*,\s*modelis/i.test(t) ||
    /^Pirmās\s+reģistrācijas/i.test(t)
  );
}

/** Bloks pēc virsraksta „Iepriekšējās apskates dati”. */
function extractIepriekšējāsApskatesDati(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*Iepriekšējās\s+apskates\s+dati\b/i.test(lines[i].trim())) continue;
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const L = lines[j];
      const t = L.trim();
      if (!t) {
        let k = j + 1;
        while (k < lines.length && !lines[k].trim()) k++;
        if (k < lines.length && isCsddSectionHeaderLine(lines[k])) break;
        out.push(L);
        continue;
      }
      if (isCsddSectionHeaderLine(L)) break;
      out.push(L);
    }
    const s = out.join("\n").trim();
    return s || null;
  }
  return null;
}

function looksLikeSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/Nobraukuma\s+vēsture/i.test(t)) return false;
  if (isCsddSectionHeaderLine(line)) return true;
  if (/^(Tehniskie dati|Ceļa nodoklis)/i.test(t)) return true;
  return false;
}

/**
 * Rindas pēc „Nobraukuma vēsture LV” — datums + divi skaitļi.
 * Pirmā rinda = jaunākais ieraksts (CSDD parasti augšā).
 */
export function parseMileageHistoryLvBlock(text: string): CsddMileageHistoryRow[] {
  const lines = text.split(/\r?\n/);
  const rows: CsddMileageHistoryRow[] = [];

  let i = 0;
  while (i < lines.length) {
    if (/Nobraukuma\s+vēsture\s+LV/i.test(lines[i])) {
      i++;
      while (i < lines.length) {
        const L0 = lines[i].trim();
        if (!L0) {
          i++;
          continue;
        }
        if (/^\s*(datums|odometrs|nobraukums)\b/i.test(L0)) {
          i++;
          continue;
        }
        if (looksLikeSectionHeader(L0) && !/^\d{2}\.\d{2}\.\d{4}/.test(L0)) break;

        const L = L0;
        const tabs = L.split("\t").map((c) => c.trim());
        if (tabs.length >= 3 && /^\d{2}\.\d{2}\.\d{4}$/.test(tabs[0])) {
          rows.push({
            date: tabs[0],
            odometer: digitsOnly(tabs[1]) || tabs[1].trim(),
            distance: digitsOnly(tabs[2]) || tabs[2].trim(),
          });
          i++;
          continue;
        }
        const sp = L.split(/\s+/).filter(Boolean);
        if (sp.length >= 3 && /^\d{2}\.\d{2}\.\d{4}$/.test(sp[0])) {
          rows.push({
            date: sp[0],
            odometer: digitsOnly(sp[1]) || sp[1],
            distance: digitsOnly(sp[2]) || sp[2],
          });
          i++;
          continue;
        }
        break;
      }
      break;
    }
    i++;
  }
  return rows;
}

/**
 * Rindas pēc „Nobraukums ārvalstīs” — Datums | Odometrs | Avots/Valsts.
 * Trešā kolonna var būt valsts vai ārvalstu reģistra nosaukums.
 */
export function parseMileageAbroadBlock(text: string): CsddMileageAbroadRow[] {
  const lines = text.split(/\r?\n/);
  const rows: CsddMileageAbroadRow[] = [];

  let i = 0;
  while (i < lines.length) {
    if (/Nobraukums\s+ārvalstīs/i.test(lines[i])) {
      i++;
      while (i < lines.length) {
        const L0 = lines[i].trim();
        if (!L0) {
          i++;
          continue;
        }
        if (/^\s*(datums|odometrs|avots|valsts|nobraukums)\b/i.test(L0)) {
          i++;
          continue;
        }
        if (looksLikeSectionHeader(L0) && !/^\d{2}\.\d{2}\.\d{4}/.test(L0)) break;

        const L = L0;
        const tabs = L.split("\t").map((c) => c.trim());
        if (tabs.length >= 3 && /^\d{2}\.\d{2}\.\d{4}$/.test(tabs[0])) {
          rows.push({
            date: tabs[0],
            odometer: digitsOnly(tabs[1]) || tabs[1].trim(),
            source: tabs.slice(2).join(" ").trim(),
          });
          i++;
          continue;
        }
        const sp = L.split(/\s+/).filter(Boolean);
        if (sp.length >= 3 && /^\d{2}\.\d{2}\.\d{4}$/.test(sp[0])) {
          rows.push({
            date: sp[0],
            odometer: digitsOnly(sp[1]) || sp[1],
            source: sp.slice(2).join(" "),
          });
          i++;
          continue;
        }
        break;
      }
      break;
    }
    i++;
  }
  return rows;
}

type CsddPasteStringKey = Exclude<
  keyof CsddFormFields,
  "rawUnprocessedData" | "mileageHistoryLv" | "mileageHistoryAbroad" | "detailedRatingRows" | "prevInspectionDefectRows"
>;

export type CsddPasteParseResult = {
  fieldUpdates: Partial<Pick<CsddFormFields, CsddPasteStringKey>>;
  mileageHistoryLv: CsddMileageHistoryRow[];
  mileageHistoryAbroad: CsddMileageAbroadRow[];
  nextInspectionIso: string | null;
  /** Iepriekšējās apskates datums — tikai no augšējā bloka (ne vēsture). */
  prevInspectionIso: string | null;
  detailedRatingRows: CsddDefectRow[] | null;
  prevInspectionDefectRows: CsddDefectRow[] | null;
};

/**
 * Parsēšana no augšas uz leju: vispirms augšējā bloka lauki un „Detalizētais vērtējums”
 * (tikai pirms „Iepriekšējās apskates dati”), tad atsevišķi nobraukums un vēstures tabula.
 */
export function parseCsddPaste(raw: string): CsddPasteParseResult {
  const fieldUpdates: Partial<Pick<CsddFormFields, CsddPasteStringKey>> = {};

  const mm = extractMakeModel(raw);
  if (mm) fieldUpdates.makeModel = mm;

  const fr = extractFirstReg(raw);
  if (fr) {
    const iso = lvDateToIso(fr);
    if (iso) fieldUpdates.firstRegDate = iso;
  }

  const reg = extractRegNumber(raw);
  if (reg) fieldUpdates.regNumber = reg;

  const odo = extractNumericAfterLabel(raw, /Odometra\s+rādījums\s*:\s*(.+)$/i);
  if (odo) fieldUpdates.odometer = odo;

  const kw = extractNumericAfterLabel(raw, /Motora\s+maksimālā\s+jauda\s*\(kW\)\s*:\s*(.+)$/i);
  if (kw) fieldUpdates.enginePowerKw = kw;

  const gross = extractNumericAfterLabel(raw, /Pilna\s+masa\s*\(kg\)\s*:\s*(.+)$/i);
  if (gross) fieldUpdates.grossMassKg = gross;

  const curb = extractNumericAfterLabel(raw, /Pašmasa\s*\(kg\)\s*:\s*(.+)$/i);
  if (curb) fieldUpdates.curbWeightKg = curb;

  const tax = extractRoadTaxEur(raw);
  if (tax) fieldUpdates.roadTaxYearly = tax;

  const solid = extractSolidParticlesOrSmokeCoefficient(raw);
  if (solid) fieldUpdates.solidParticlesCm3 = solid;

  const regStatus = extractLabeledLine(raw, /Reģistrācijas\s+statuss\s*:\s*(.+)$/i);
  if (regStatus) fieldUpdates.registrationStatus = clipParsedScalar(regStatus, 400);

  const textBeforePrevSection = sliceTextBeforeIepriekšējāsApskatesSection(raw);
  const det = extractDetalizētaisVērtējums(textBeforePrevSection);
  const detailedRatingRows =
    det && det.trim() ? parseDefectRowsFromText(det) : null;

  const ip = extractIepriekšējāsApskatesDati(raw);
  const prevInspectionDefectRows =
    ip && ip.trim() ? parseDefectRowsFromText(ip) : null;

  const mileageHistoryLv = parseMileageHistoryLvBlock(raw);
  const mileageHistoryAbroad = parseMileageAbroadBlock(raw);
  const headForNextInspection = sliceTextBeforeNextInspectionHeadBoundary(raw);
  const nextInspectionIso = extractNextInspectionDateIsoFromHead(headForNextInspection);
  const prevInspectionIso = extractPrevInspectionDateIsoFromHead(headForNextInspection);

  return {
    fieldUpdates,
    mileageHistoryLv,
    mileageHistoryAbroad,
    nextInspectionIso,
    prevInspectionIso,
    detailedRatingRows,
    prevInspectionDefectRows,
  };
}

export function applyCsddPasteToForm(
  current: CsddFormFields,
  rawText: string,
  parsed: CsddPasteParseResult,
): CsddFormFields {
  const next: CsddFormFields = {
    ...current,
    rawUnprocessedData: rawText,
  };

  for (const [k, v] of Object.entries(parsed.fieldUpdates) as [CsddPasteStringKey, string | undefined][]) {
    if (typeof v === "string" && v.trim().length > 0) {
      (next as Record<string, unknown>)[k] = v;
    }
  }

  if (parsed.mileageHistoryLv.length > 0) {
    next.mileageHistoryLv = parsed.mileageHistoryLv;
  }

  if (parsed.mileageHistoryAbroad.length > 0) {
    next.mileageHistoryAbroad = parsed.mileageHistoryAbroad;
  }

  if (parsed.nextInspectionIso) {
    next.nextInspectionDate = parsed.nextInspectionIso;
  } else if (isLikelyStructuredCsddPaste(rawText)) {
    next.nextInspectionDate = "";
  }

  if (parsed.prevInspectionIso) {
    next.prevInspectionDate = parsed.prevInspectionIso;
  } else if (isLikelyStructuredCsddPaste(rawText)) {
    next.prevInspectionDate = "";
  }

  if (parsed.detailedRatingRows !== null && parsed.detailedRatingRows.length > 0) {
    next.detailedRatingRows = parsed.detailedRatingRows;
    next.prevInspectionRating = "";
  }

  if (parsed.prevInspectionDefectRows !== null && parsed.prevInspectionDefectRows.length > 0) {
    next.prevInspectionDefectRows = parsed.prevInspectionDefectRows;
  }

  return next;
}
