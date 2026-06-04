/**
 * CSDD „Nobraukuma vēsture” — blīvs PDF teksts (vairāki pāri vienā rindā).
 */
import {
  CSDD_MILEAGE_COUNTRY_LV,
  finalizeMileageHistory,
  normalizeOdometerFromPaste,
  type CsddMileageRow,
} from "@/lib/admin-source-blocks";
import { normalizeCsddRawText } from "@/lib/csdd-extended-parse";

const MILEAGE_PAIR_RE = /(\d{4,7})\s*[-–—]\s*(\d{2}\.\d{2}\.\d{4})/g;

const NOBRAUKUMA_END_RE =
  /Nobraukums\s+ārvalst|Tehnisko\s+apskašu|Iepriekšējās\s+apskates|Transportlīdzekļa\s+reģistrācija|Pēdējā\s+tehniskā|Detalizētais\s+vērtējums|Informācija\s+sagatavota/i;

/** Izņem „Nobraukuma vēsture” saturu (ar vai bez „LV”). */
export function extractCsddNobraukumaSection(raw: string): string {
  const text = normalizeCsddRawText(raw);
  const head = text.match(/Nobraukuma\s+vēsture(?:\s+LV)?/i);
  if (!head || head.index == null) return "";
  const start = head.index + head[0].length;
  const tail = text.slice(start);
  const end = tail.search(NOBRAUKUMA_END_RE);
  return (end >= 0 ? tail.slice(0, end) : tail).slice(0, 24_000);
}

/** Visi odometrs + datums pāri no sadaļas vai visa raw. */
export function parseCsddMileagePairsDense(raw: string): CsddMileageRow[] {
  const section = /Nobraukuma\s+vēsture/i.test(raw) ? extractCsddNobraukumaSection(raw) : raw;
  const rows: CsddMileageRow[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  MILEAGE_PAIR_RE.lastIndex = 0;
  while ((m = MILEAGE_PAIR_RE.exec(section)) !== null) {
    const odometer = normalizeOdometerFromPaste(m[1] ?? "");
    const date = (m[2] ?? "").trim();
    if (!odometer || odometer.length < 3 || !date) continue;
    const key = `${date}|${odometer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ date, odometer, country: CSDD_MILEAGE_COUNTRY_LV });
  }
  return finalizeMileageHistory(rows);
}
