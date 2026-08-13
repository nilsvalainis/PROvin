/**
 * Apkopju / remontu ieraksti no avotu atskaitēm → admin lauks „OFICIĀLĀ DĪLERA DATI · Servisa vēsture”.
 *
 * Tehniskās apskates (TA) šeit NEIET — tās ir nobraukuma / apskašu vēsture, nevis veiktie darbi.
 * Formāts vienā rindā: `DD.MM.YYYY | 47 521 km | Regulārā apkope: eļļas maiņa, filtri`.
 */

export type VendorServiceEntry = {
  /** DD.MM.YYYY (ja atskaitē tikai MM.YYYY — diena „01”). */
  date: string;
  /** Odometrs cipariem; tukšs, ja ierakstā nav norādīts. */
  odometer: string;
  country: string;
  /** Darbu kategorija atskaitē („Regulārā apkope”, „Remonts”); tukšs, ja nav. */
  category: string;
  /** Veiktie darbi („Eļļas maiņa”, „Salona gaisa filtra maiņa”). */
  works: string[];
};

export function emptyVendorServiceEntry(): VendorServiceEntry {
  return { date: "", odometer: "", country: "", category: "", works: [] };
}

/** Tehniskās apskates un citi ne-servisa notikumi, kas nedrīkst iekļūt servisa vēsturē. */
const NON_SERVICE_TITLE_RE =
  /(tehnisk[āa]\s+apskate|tehnisk[āa]s\s+apskates|izpl[ūu]des\s+g[āa]zu|emisij|zi[ņn]ots\s+par\s+odometra|zaud[ēe]jumu\s+apjoms|re[ģg]istr|no[ņn]em[šs]ana\s+no\s+uzskaites|eksports|p[āa]rdo[šs]anai|izsol|apdro[šs]in|[īi]pa[šs]nieku|technical\s+inspection|roadworthiness)/i;

/** Servisa / remonta notikumu virsraksti („Transportlīdzekļu apkalpošana vai apskate”, „Veikta apkope”). */
const SERVICE_TITLE_RE =
  /(apkalpo[šs]an|apkope|apkopes|serviss|servisa|remont|maintenance|service|repair|inspection\s+or\s+service)/i;

/**
 * Vai notikuma virsraksts ir apkope / remonts (nevis tehniskā apskate).
 * „Transportlīdzekļu apkalpošana vai apskate” → jā; „Veikta tehniskā apskate” → nē.
 */
export function isVendorServiceEventTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (!SERVICE_TITLE_RE.test(t)) return false;
  // „Veikta tehniskā apskate” satur „apskate”, bet nav apkope; „apkalpošana vai apskate” ir.
  if (NON_SERVICE_TITLE_RE.test(t) && !/apkalpo[šs]an|apkope|remont|serviss/i.test(t)) return false;
  return true;
}

const CATEGORY_RE =
  /^(regul[āa]r[āa]\s+apkope|neregul[āa]r[āa]\s+apkope|papildu\s+apkope|apkope|remonts|garantijas\s+remonts|remontdarbi|servisa\s+darbi)$/i;

/** Vai rinda ir darbu kategorija („Regulārā apkope”), nevis konkrēts darbs. */
export function isVendorServiceCategoryLine(line: string): boolean {
  return CATEGORY_RE.test(line.trim().replace(/[:.]$/, ""));
}

function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function normalizeWork(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[;,.]+$/, "").trim();
}

/** Viens ieraksts → viena rinda „Servisa vēsture” laukam. */
export function formatVendorServiceEntryLine(entry: VendorServiceEntry): string {
  const date = entry.date.trim();
  if (!date) return "";
  const works = entry.works.map(normalizeWork).filter(Boolean);
  const category = normalizeWork(entry.category);
  const worksText = works.join(", ");
  const detail = category && worksText ? `${category}: ${worksText}` : worksText || category;
  if (!detail) return "";
  const odometer = entry.odometer.replace(/\D/g, "");
  const parts = [date, odometer ? `${groupDigits(odometer)} km` : "", detail].filter(Boolean);
  return parts.join(" | ");
}

/** Jaunākais augšā (kā atskaitē un nobraukuma tabulās); vienā datumā — lielāks odometrs augšā. */
export function sortVendorServiceEntries(entries: VendorServiceEntry[]): VendorServiceEntry[] {
  return [...entries].sort((a, b) => {
    const ta = serviceDateSortKey(a.date);
    const tb = serviceDateSortKey(b.date);
    if (ta !== tb) return tb - ta;
    const oa = Number.parseInt(a.odometer.replace(/\D/g, ""), 10);
    const ob = Number.parseInt(b.odometer.replace(/\D/g, ""), 10);
    return (Number.isFinite(ob) ? ob : -1) - (Number.isFinite(oa) ? oa : -1);
  });
}

function serviceDateSortKey(date: string): number {
  const m = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return -1;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function entryKey(entry: VendorServiceEntry): string {
  return `${entry.date}|${entry.odometer.replace(/\D/g, "")}`;
}

/** Apvieno divus avotus: viens ieraksts uz datumu+odometru, paturot detalizētāko darbu sarakstu. */
export function mergeVendorServiceEntries(
  primary: VendorServiceEntry[],
  secondary: VendorServiceEntry[],
): VendorServiceEntry[] {
  const byKey = new Map<string, VendorServiceEntry>();
  for (const entry of [...primary, ...secondary]) {
    if (!entry.date.trim()) continue;
    const key = entryKey(entry);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, entry);
      continue;
    }
    const merged: VendorServiceEntry = {
      date: prev.date,
      odometer: prev.odometer || entry.odometer,
      country: prev.country || entry.country,
      category: prev.category || entry.category,
      works: dedupeWorks([...prev.works, ...entry.works]),
    };
    byKey.set(key, merged);
  }
  return sortVendorServiceEntries([...byKey.values()]);
}

function dedupeWorks(works: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of works) {
    const work = normalizeWork(raw);
    if (!work) continue;
    const key = work.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(work);
  }
  return out;
}

/** Ieraksti → teksts „Servisa vēsture” laukam (viena rinda uz apkopi). */
export function formatVendorServiceHistoryText(entries: VendorServiceEntry[]): string {
  return sortVendorServiceEntries(entries)
    .map(formatVendorServiceEntryLine)
    .filter(Boolean)
    .join("\n");
}

const SERVICE_LINE_RE = /^\d{1,2}\.\d{1,2}\.\d{4}\s*\|/;

/** Rinda salīdzināšanai (bez HTML, atstarpēm, reģistra) — dublikātu novēršanai laukā. */
function serviceLineKey(line: string): string {
  return line
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toLowerCase();
}

function splitFieldLines(value: string): string[] {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Pievieno jaunās servisa rindas laukam: dublikātus izlaiž, un, ja laukā ir tikai
 * servisa rindas, visu sakārto hronoloģiski (jaunākais augšā). Operatora tekstu nepārraksta.
 */
export function mergeServiceHistoryFieldText(
  existing: string,
  incoming: string,
  maxLen = 12_000,
): string {
  const incomingLines = splitFieldLines(incoming);
  if (incomingLines.length === 0) return existing;

  const existingLines = splitFieldLines(existing);
  const existingKeys = new Set(existingLines.map(serviceLineKey));
  const fresh = incomingLines.filter((l) => !existingKeys.has(serviceLineKey(l)));
  if (fresh.length === 0) return existing;
  if (existingLines.length === 0) return fresh.join("\n").slice(0, maxLen);

  const all = [...existingLines, ...fresh];
  const allAreServiceLines = all.every((l) => SERVICE_LINE_RE.test(serviceLineKey(l)));
  if (!allAreServiceLines) return `${existing.trim()}\n${fresh.join("\n")}`.slice(0, maxLen);

  return all
    .sort((a, b) => serviceDateSortKey(lineDate(b)) - serviceDateSortKey(lineDate(a)))
    .join("\n")
    .slice(0, maxLen);
}

function lineDate(line: string): string {
  return serviceLineKey(line).slice(0, 10);
}
