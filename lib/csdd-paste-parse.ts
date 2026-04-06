/**
 * CSDD „Smart Paste” — apskates datumi (augša) + apvienota nobraukuma tabula (Datums | Odometrs | Valsts).
 */

import {
  CSDD_MILEAGE_COUNTRY_LV,
  emptyCsddFields,
  finalizeMileageHistory,
  normalizeOdometerFromPaste,
  type CsddFormFields,
  type CsddMileageRow,
} from "@/lib/admin-source-blocks";

/** Rindas, pēc kurām „Nākamās / Iepriekšējās apskates datums” vairs nedrīkst ņemt. */
const NEXT_INSPECTION_HEAD_BOUNDARY_RES = [
  /^\s*Iepriekšējās\s+apskates\s+dati\b/i,
  /^\s*Nobraukuma\s+vēsture/i,
  /^\s*Nobraukums\s+ārvalst/i,
];

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

export function isLikelyStructuredCsddPaste(rawText: string): boolean {
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

function looksLikeSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/Nobraukuma\s+vēsture/i.test(t)) return false;
  if (isCsddSectionHeaderLine(line)) return true;
  if (/^(Tehniskie dati|Ceļa nodoklis)/i.test(t)) return true;
  return false;
}

function pushLvRow(rows: CsddMileageRow[], date: string, odometerRaw: string): void {
  rows.push({
    date,
    odometer: normalizeOdometerFromPaste(odometerRaw),
    country: CSDD_MILEAGE_COUNTRY_LV,
  });
}

/**
 * „Nobraukuma vēsture LV” — Datums | Odometrs; valsts = Latvija.
 */
export function parseMileageHistoryLvBlock(text: string): CsddMileageRow[] {
  const lines = text.split(/\r?\n/);
  const rows: CsddMileageRow[] = [];

  let i = 0;
  while (i < lines.length) {
    if (/Nobraukuma\s+vēsture(?:\s+LV)?/i.test(lines[i])) {
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
        if (tabs.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(tabs[0])) {
          pushLvRow(rows, tabs[0], tabs[1] ?? "");
          i++;
          continue;
        }
        const sp = L.split(/\s+/).filter(Boolean);
        if (sp.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(sp[0])) {
          pushLvRow(rows, sp[0], sp[1] ?? "");
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
 * „Nobraukums ārvalstīs” — Datums | Odometrs | Valsts (trešā kolonna).
 */
export function parseMileageAbroadBlock(text: string): CsddMileageRow[] {
  const lines = text.split(/\r?\n/);
  const rows: CsddMileageRow[] = [];

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
        if (tabs.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(tabs[0])) {
          const country =
            tabs.length >= 3 ? tabs.slice(2).join(" ").trim() : "";
          rows.push({
            date: tabs[0],
            odometer: normalizeOdometerFromPaste(tabs[1] ?? ""),
            country,
          });
          i++;
          continue;
        }
        const sp = L.split(/\s+/).filter(Boolean);
        if (sp.length >= 3 && /^\d{2}\.\d{2}\.\d{4}$/.test(sp[0])) {
          rows.push({
            date: sp[0],
            odometer: normalizeOdometerFromPaste(sp[1] ?? ""),
            country: sp.slice(2).join(" ").trim(),
          });
          i++;
          continue;
        }
        if (sp.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(sp[0])) {
          rows.push({
            date: sp[0],
            odometer: normalizeOdometerFromPaste(sp[1] ?? ""),
            country: "",
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

export type CsddPasteParseResult = {
  mileageHistory: CsddMileageRow[];
  nextInspectionIso: string | null;
  prevInspectionIso: string | null;
};

export function parseCsddPaste(raw: string): CsddPasteParseResult {
  const fromLv = parseMileageHistoryLvBlock(raw);
  const fromAbroad = parseMileageAbroadBlock(raw);
  const mileageHistory = finalizeMileageHistory([...fromLv, ...fromAbroad]);
  const headForDates = sliceTextBeforeNextInspectionHeadBoundary(raw);
  const nextInspectionIso = extractNextInspectionDateIsoFromHead(headForDates);
  const prevInspectionIso = extractPrevInspectionDateIsoFromHead(headForDates);
  return {
    mileageHistory,
    nextInspectionIso,
    prevInspectionIso,
  };
}

/**
 * Katrs raw lauka mainījums: forma tiek atiestatīta uz tikai parsēto (tīrīšana no vecajiem laukiem).
 */
export function applyCsddPasteToForm(
  current: CsddFormFields,
  rawText: string,
  parsed: CsddPasteParseResult,
): CsddFormFields {
  let nextInspectionDate = "";
  let prevInspectionDate = "";
  if (parsed.nextInspectionIso) {
    nextInspectionDate = parsed.nextInspectionIso;
  } else if (!isLikelyStructuredCsddPaste(rawText)) {
    nextInspectionDate = current.nextInspectionDate;
  }
  if (parsed.prevInspectionIso) {
    prevInspectionDate = parsed.prevInspectionIso;
  } else if (!isLikelyStructuredCsddPaste(rawText)) {
    prevInspectionDate = current.prevInspectionDate;
  }

  return {
    ...emptyCsddFields(),
    rawUnprocessedData: rawText,
    nextInspectionDate,
    prevInspectionDate,
    mileageHistory: parsed.mileageHistory,
  };
}
