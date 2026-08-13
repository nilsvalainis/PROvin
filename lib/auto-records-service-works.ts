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
import { isVendorServiceCategoryLine } from "@/lib/vendor-service-history";

export type AutoRecordsServiceWorkRow = {
  /** DD.MM.YYYY (ja zināms tikai mēnesis — diena „01”). */
  date: string;
  /** Odometrs cipariem; tukšs, ja ierakstā nav. */
  odometer: string;
  /** Servisa punkts, kur darbi veikti, piem. „Niederlassung Bonn BMW AG, Bonn”. */
  location: string;
  /** Veiktie darbi, piem. „Regulārā apkope: eļļas maiņa, salona gaisa filtrs”. */
  works: string;
};

/** Darbu saraksts var būt garš (dīlera apkopes pozīcijas) — atļaujam plašu tekstu. */
export const AUTO_RECORDS_SERVICE_WORKS_MAX_LEN = 8_000;
export const AUTO_RECORDS_SERVICE_WORKS_LOCATION_MAX_LEN = 200;
export const AUTO_RECORDS_SERVICE_WORKS_MAX_ROWS = 300;

export const PROVIN_SERVICE_WORKS_TABLE_TITLE = "SERVISA UN REMONTU VĒSTURE";
export const PROVIN_SERVICE_WORKS_TABLE_DOM_KIND = "servisa_vesture";
export const PROVIN_SERVICE_WORKS_TABLE_FIELD = {
  datums: "servisa_vesture_datums",
  odometrsKm: "servisa_vesture_odometrs",
  vieta: "servisa_vesture_vieta",
  darbi: "servisa_vesture_darbi",
} as const;

/** Vietas kolonnas etiķete tabulās, plain-text izvadā un klienta PDF. */
export const SERVICE_WORKS_LOCATION_LABEL = "Vieta";

export function emptyAutoRecordsServiceWorkRow(): AutoRecordsServiceWorkRow {
  return { date: "", odometer: "", location: "", works: "" };
}

export function autoRecordsServiceWorkRowHasData(r: AutoRecordsServiceWorkRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.location.trim() || r.works.trim());
}

/** PDF / klienta atskaitei — rinda ar datumu/odometru un vietu vai darbiem. */
export function autoRecordsServiceWorkRowIsPrintable(r: AutoRecordsServiceWorkRow): boolean {
  return Boolean((r.works.trim() || r.location.trim()) && (r.date.trim() || r.odometer.trim()));
}

const DEALER_ID_LABEL_RE = /^(d[īi]lera?\s+id|dealer\s+id)$/i;

/** Servisa punkta pazīmes, kas nedrīkst palikt „Veiktie darbi” kolonnā. */
const SERVICE_WORK_LOCATION_HINT_RE =
  /\b(gmbh|s\.r\.o\.|srl|ltd\.?|llc|inc\.?|autohaus|autosalon|niederlassung|werkstatt|workshop|einsatzleitzentrale|mobiler\s+service|d[īi]lera?\s+id|dealer(?:\s+id)?)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Vai teksts izskatās pēc dīlera / darbnīcas, nevis pēc darbu kategorijas. */
export function looksLikeServiceWorkLocation(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 4 || t.length > AUTO_RECORDS_SERVICE_WORKS_LOCATION_MAX_LEN) return false;
  if (isVendorServiceCategoryLine(t)) return false;
  if (SERVICE_WORK_LOCATION_HINT_RE.test(t)) return true;
  if (/^.+,\s*\p{Lu}[\p{L}'\-]{1,40}$/u.test(t) && !/apkope|remont/i.test(t)) return true;
  return false;
}

/**
 * Gemini / vecākas rindas bieži saliek servisa punktu darbu tekstā:
 * „B&K Deutschland GmbH, Osnabrück: detalizēts darbu saraksts…”.
 * Atgriež punktu „Vieta” kolonnai un pārējo — darbiem.
 */
export function peelEmbeddedServiceWorkLocation(
  location: string,
  works: string,
): { location: string; works: string } {
  const place = location.replace(/\s+/g, " ").trim();
  let detail = works.replace(/[ \t]+/g, " ").replace(/\u00a0/g, " ").trim();

  if (place) {
    const prefix = new RegExp(`^${escapeRegExp(place)}\\s*:\\s*`, "i");
    if (prefix.test(detail)) detail = detail.replace(prefix, "").trim();
    return { location: place, works: detail };
  }

  if (!detail.includes(":")) return { location: place, works: detail };

  for (let i = 0; i < detail.length; i++) {
    if (detail[i] !== ":") continue;
    const left = detail.slice(0, i).trim();
    const right = detail.slice(i + 1).trim();
    if (!left) continue;
    if (isVendorServiceCategoryLine(left)) break;
    if (DEALER_ID_LABEL_RE.test(left)) continue;
    if (!looksLikeServiceWorkLocation(left)) continue;
    return { location: left, works: right };
  }

  return { location: place, works: detail };
}

export function normalizeAutoRecordsServiceWorkRow(
  r: AutoRecordsServiceWorkRow,
): AutoRecordsServiceWorkRow {
  const peeled = peelEmbeddedServiceWorkLocation(r.location, r.works);
  return {
    date: formatAutoRecordsDateForOutput(r.date) || r.date.trim().slice(0, 40),
    odometer: normalizeAutoRecordsOdometer(r.odometer).slice(0, 40),
    location: peeled.location.slice(0, AUTO_RECORDS_SERVICE_WORKS_LOCATION_MAX_LEN),
    works: peeled.works.slice(0, AUTO_RECORDS_SERVICE_WORKS_MAX_LEN),
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
      location: String(x.location ?? ""),
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
    const key = `${rowKey(r)}|${r.location.trim().toLowerCase()}|${r.works.trim().toLowerCase()}`;
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
    // Tukšu vietas kolonnu drīkst papildināt (rindas no vecākām apstrādēm bez šīs kolonnas).
    const filled = withData.map((r) =>
      rowKey(r) === key && !r.location.trim() && row.location.trim()
        ? { ...r, location: row.location }
        : r,
    );
    return sortAutoRecordsServiceWorkRows(filled.length > 0 ? filled : [row]);
  }
  if (withData.length >= AUTO_RECORDS_SERVICE_WORKS_MAX_ROWS) return existing;
  return sortAutoRecordsServiceWorkRows([...withData, row]);
}

const SERVICE_TEXT_LINE_RE = /^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?\s*\|(.*)$/;

const LOCATION_PART_RE = new RegExp(`^(?:${SERVICE_WORKS_LOCATION_LABEL}|vieta)\\s*:\\s*(.+)$`, "i");

/**
 * Teksta rindas („01.12.2023 | 47 521 km | Regulārā apkope: eļļas maiņa | Vieta: BMW Bonn”)
 * → tabulas rindas. Ļauj pārnest esošo brīvā teksta lauku uz strukturēto tabulu.
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
    const detailParts = isKm ? parts.slice(1) : parts;
    let location = "";
    const workParts: string[] = [];
    for (const part of detailParts) {
      const hit = part.match(LOCATION_PART_RE);
      if (hit && !location) location = (hit[1] ?? "").trim();
      else workParts.push(part);
    }
    const works = workParts.join(" | ").trim();
    if (!works) continue;
    rows.push(normalizeAutoRecordsServiceWorkRow({ date: m[1]!, odometer, location, works }));
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
        location: "",
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
    .map((r) =>
      [
        r.date,
        formatServiceWorkOdometer(r.odometer),
        r.works,
        r.location.trim() ? `${SERVICE_WORKS_LOCATION_LABEL}: ${r.location.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}
