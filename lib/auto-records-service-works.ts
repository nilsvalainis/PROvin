/**
 * OFICIĀLĀ DĪLERA DATI → „SERVISA UN REMONTU VĒSTURE” strukturētās rindas:
 * datums + odometrs + veiktie darbi (rediģējamas kā nobraukuma / negadījumu tabulas).
 *
 * Brīvā teksta lauks „Servisa vēsture” (`serviceHistoryNotes`) paliek kā rezerve avotiem,
 * kuriem nav automātiski nolasāma formāta.
 */

import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
} from "@/lib/auto-records-paste-parse";

export type AutoRecordsServiceWorkRow = {
  /** DD.MM.YYYY (ja zināms tikai mēnesis — diena „01”). */
  date: string;
  /** Odometrs cipariem; tukšs, ja ierakstā nav. */
  odometer: string;
  /** Veiktie darbi, piem. „Regulārā apkope: eļļas maiņa, salona gaisa filtrs”. */
  works: string;
};

/** Darbu saraksts var būt garš (dīlera apkopes pozīcijas) — atļaujam plašu tekstu. */
export const AUTO_RECORDS_SERVICE_WORKS_MAX_LEN = 8_000;
export const AUTO_RECORDS_SERVICE_WORKS_MAX_ROWS = 300;

export const PROVIN_SERVICE_WORKS_TABLE_TITLE = "SERVISA UN REMONTU VĒSTURE";
export const PROVIN_SERVICE_WORKS_TABLE_DOM_KIND = "servisa_vesture";
export const PROVIN_SERVICE_WORKS_TABLE_FIELD = {
  datums: "servisa_vesture_datums",
  odometrsKm: "servisa_vesture_odometrs",
  darbi: "servisa_vesture_darbi",
} as const;

export function emptyAutoRecordsServiceWorkRow(): AutoRecordsServiceWorkRow {
  return { date: "", odometer: "", works: "" };
}

export function autoRecordsServiceWorkRowHasData(r: AutoRecordsServiceWorkRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.works.trim());
}

/** PDF / klienta atskaitei — rinda skaitās tikai ar aprakstītiem darbiem. */
export function autoRecordsServiceWorkRowIsPrintable(r: AutoRecordsServiceWorkRow): boolean {
  return Boolean(r.works.trim() && (r.date.trim() || r.odometer.trim()));
}

export function normalizeAutoRecordsServiceWorkRow(
  r: AutoRecordsServiceWorkRow,
): AutoRecordsServiceWorkRow {
  return {
    date: formatAutoRecordsDateForOutput(r.date) || r.date.trim().slice(0, 40),
    odometer: normalizeAutoRecordsOdometer(r.odometer).slice(0, 40),
    works: r.works.replace(/[ \t]+/g, " ").trim().slice(0, AUTO_RECORDS_SERVICE_WORKS_MAX_LEN),
  };
}

function dateSortKey(date: string): number {
  const m = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

/** Jaunākais augšā; vienā datumā — lielāks odometrs augšā; tukšas rindas beigās. */
export function sortAutoRecordsServiceWorkRows(
  rows: AutoRecordsServiceWorkRow[],
): AutoRecordsServiceWorkRow[] {
  return [...rows].sort((a, b) => {
    const ka = dateSortKey(a.date);
    const kb = dateSortKey(b.date);
    if (ka !== kb) {
      if (ka === 0) return 1;
      if (kb === 0) return -1;
      return kb - ka;
    }
    const na = Number.parseInt(a.odometer.replace(/\D/g, ""), 10) || 0;
    const nb = Number.parseInt(b.odometer.replace(/\D/g, ""), 10) || 0;
    return nb - na;
  });
}

/** Nezināma forma (localStorage / API) → derīgas rindas ar vismaz vienu tukšu ievades rindu. */
export function normalizeAutoRecordsServiceWorkRows(raw: unknown): AutoRecordsServiceWorkRow[] {
  const list = Array.isArray(raw) ? raw : [];
  const rows: AutoRecordsServiceWorkRow[] = [];
  for (const item of list.slice(0, AUTO_RECORDS_SERVICE_WORKS_MAX_ROWS)) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    const row = normalizeAutoRecordsServiceWorkRow({
      date: String(x.date ?? ""),
      odometer: String(x.odometer ?? ""),
      works: String(x.works ?? ""),
    });
    if (!autoRecordsServiceWorkRowHasData(row)) continue;
    rows.push(row);
  }
  const sorted = sortAutoRecordsServiceWorkRows(dedupeRows(rows));
  return sorted.length > 0 ? sorted : [emptyAutoRecordsServiceWorkRow()];
}

function rowKey(r: AutoRecordsServiceWorkRow): string {
  return `${r.date.trim()}|${r.odometer.replace(/\D/g, "")}`;
}

function dedupeRows(rows: AutoRecordsServiceWorkRow[]): AutoRecordsServiceWorkRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceWorkRow[] = [];
  for (const r of rows) {
    const key = `${rowKey(r)}|${r.works.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Copilot rindas pievienošana: aizpilda tukšo slotu vai pieliek klāt.
 * Ja datums+odometrs jau ir tabulā, rindu neaiztiek (operatora labojumi paliek).
 */
export function mergeAutoRecordsServiceWorkRow(
  existing: AutoRecordsServiceWorkRow[],
  incoming: AutoRecordsServiceWorkRow,
): AutoRecordsServiceWorkRow[] {
  const row = normalizeAutoRecordsServiceWorkRow(incoming);
  if (!autoRecordsServiceWorkRowHasData(row)) return existing;

  const withData = existing.filter(autoRecordsServiceWorkRowHasData);
  const key = rowKey(row);
  if (withData.some((r) => rowKey(r) === key)) {
    return sortAutoRecordsServiceWorkRows(withData.length > 0 ? withData : [row]);
  }
  if (withData.length >= AUTO_RECORDS_SERVICE_WORKS_MAX_ROWS) return existing;
  return sortAutoRecordsServiceWorkRows([...withData, row]);
}

const SERVICE_TEXT_LINE_RE = /^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?\s*\|(.*)$/;

/**
 * Teksta rindas („01.12.2023 | 47 521 km | Regulārā apkope: eļļas maiņa”) → tabulas rindas.
 * Ļauj pārnest esošo brīvā teksta lauku uz strukturēto tabulu.
 */
export function parseAutoRecordsServiceWorkLines(text: string): AutoRecordsServiceWorkRow[] {
  const rows: AutoRecordsServiceWorkRow[] = [];
  for (const raw of text.replace(/\u00a0/g, " ").split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(SERVICE_TEXT_LINE_RE);
    if (!m) continue;
    const rest = m[2] ?? "";
    const parts = rest.split("|").map((p) => p.trim());
    const kmPart = parts[0] ?? "";
    const isKm = /^[\d\s]+(km)?$/i.test(kmPart) && /\d/.test(kmPart);
    const odometer = isKm ? normalizeAutoRecordsOdometer(kmPart) : "";
    const works = (isKm ? parts.slice(1) : parts).join(" | ").trim();
    if (!works) continue;
    rows.push(normalizeAutoRecordsServiceWorkRow({ date: m[1]!, odometer, works }));
  }
  return sortAutoRecordsServiceWorkRows(dedupeRows(rows));
}

const DEALER_NARRATIVE_LINE_RE =
  /^(\d{1,2})\.(\d{4})\.\s*\(([\d\s.,]+)\s*km\s*[| ]\s*[^)]*?\)\s*[:;.]?\s*(.*)$/i;

/**
 * Dīlera servisa narratīvs („02.2026. (278 484 km | Vācija): Veikta regulārā apkope…”)
 * → tabulas rindas ar veiktajiem darbiem. Nobraukuma tabula šo aprakstu neglabā.
 */
export function parseDealerNarrativeServiceWorks(raw: string): AutoRecordsServiceWorkRow[] {
  const text = raw.replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n");
  const rows: AutoRecordsServiceWorkRow[] = [];
  for (const line of text.split("\n")) {
    const s = line.trim().replace(/[;\s]+$/g, "");
    if (!s) continue;
    const m = DEALER_NARRATIVE_LINE_RE.exec(s);
    if (!m) continue;
    const month = Number.parseInt(m[1] ?? "", 10);
    const year = Number.parseInt(m[2] ?? "", 10);
    if (month < 1 || month > 12 || year < 1980 || year > 2100) continue;
    const works = (m[4] ?? "").trim();
    if (!works) continue;
    rows.push(
      normalizeAutoRecordsServiceWorkRow({
        date: `01.${String(month).padStart(2, "0")}.${year}`,
        odometer: m[3] ?? "",
        works,
      }),
    );
  }
  return sortAutoRecordsServiceWorkRows(dedupeRows(rows));
}

function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Odometrs tabulā / PDF: „47 521 km”. */
export function formatServiceWorkOdometer(odometer: string): string {
  const digits = odometer.replace(/\D/g, "");
  return digits ? `${groupDigits(digits)} km` : "";
}

/** Teksta izvads (Gemini konteksts, plain-text eksports). */
export function autoRecordsServiceWorkRowsToPlainText(rows: AutoRecordsServiceWorkRow[]): string {
  return sortAutoRecordsServiceWorkRows(rows.filter(autoRecordsServiceWorkRowIsPrintable))
    .map((r) => [r.date, formatServiceWorkOdometer(r.odometer), r.works].filter(Boolean).join(" | "))
    .join("\n");
}
