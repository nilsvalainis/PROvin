/**
 * CSDD „Smart Paste” — neapstrādāta teksta parsēšana admin laukām.
 */

import type { CsddFormFields, CsddMileageHistoryRow } from "@/lib/admin-source-blocks";

const LABEL_LINE_RE =
  /^[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž0-9][^:\n]{0,80}:\s*\S/;

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
 * Novērtējums: — viss teksts pēc pirmā skaitļa (piem. „1 - Ar pieļaujamiem…”).
 */
function extractNovertejums(text: string): string | null {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*Novērtējums\s*:/i.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const firstLine = lines[start].replace(/^\s*Novērtējums\s*:\s*/i, "").trim();
  const afterNum = firstLine.replace(/^\d+\s*/, "").trim();
  const block: string[] = afterNum ? [afterNum] : [];
  for (let j = start + 1; j < lines.length; j++) {
    const L = lines[j];
    if (!L.trim()) break;
    if (LABEL_LINE_RE.test(L.trim())) break;
    block.push(L.trim());
  }
  const out = block.join("\n").trim();
  return out || null;
}

function looksLikeSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/Nobraukuma\s+vēsture/i.test(t)) return false;
  if (/^(Tehniskie dati|Ceļa nodoklis|Iepriekšējās)/i.test(t)) return true;
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

/** Pirmās tabulas rindas datums → Nākamās apskates datums (ISO). */
export function firstMileageRowDateToNextInspectionIso(rows: CsddMileageHistoryRow[]): string | null {
  const first = rows[0];
  if (!first?.date?.trim()) return null;
  return lvDateToIso(first.date);
}

type CsddPasteStringKey = Exclude<keyof CsddFormFields, "rawUnprocessedData" | "mileageHistoryLv">;

export type CsddPasteParseResult = {
  fieldUpdates: Partial<Pick<CsddFormFields, CsddPasteStringKey>>;
  mileageHistoryLv: CsddMileageHistoryRow[];
  nextInspectionIso: string | null;
};

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

  const nov = extractNovertejums(raw);
  if (nov) fieldUpdates.prevInspectionRating = nov;

  const mileageHistoryLv = parseMileageHistoryLvBlock(raw);
  const nextInspectionIso =
    mileageHistoryLv.length > 0 ? firstMileageRowDateToNextInspectionIso(mileageHistoryLv) : null;

  return { fieldUpdates, mileageHistoryLv, nextInspectionIso };
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

  if (parsed.nextInspectionIso) {
    next.nextInspectionDate = parsed.nextInspectionIso;
  }

  return next;
}
