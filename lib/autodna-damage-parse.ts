/**
 * AutoDNA PDF — „Transportlīdzekļa zaudējumu apjoms” (Summa diapazons + Valsts + MM.YYYY).
 */
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";

const DAMAGE_SECTION_HINT =
  /Transportlīdzekļa\s+zaudējumu\s+apjoms|Zaudējumu\s+apjoms/i;

/** Viens negadījums: datums (MM.YYYY) … Summa … EUR … Valsts … */
const AUTODNA_DAMAGE_EVENT_RE =
  /(\d{1,2})\.(\d{4})[\s\S]{0,200}?zaudējumu\s+apjoms[\s\S]{0,450}?Summa\s+([\d\s\u00A0]+(?:\s*[-–—]\s*[\d\s\u00A0]+)?)\s*EUR[\s\S]{0,180}?Valsts\s+([A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž][A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž\s-]{1,48})/gi;

function monthYearToDateDisplay(month: string, year: string): string {
  const mo = month.padStart(2, "0");
  return formatAutoRecordsDateForOutput(`00.${mo}.${year}`);
}

function dedupeIncidents(rows: LtabIncidentRow[]): LtabIncidentRow[] {
  const seen = new Set<string>();
  const out: LtabIncidentRow[] = [];
  for (const r of rows) {
    if (!ltabRowHasData(r)) continue;
    const key = `${r.csngDate}|${r.lossAmount}|${r.incidentNo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function autodnaDamageSectionDetected(text: string): boolean {
  return DAMAGE_SECTION_HINT.test(text);
}

/** Parsē visus „zaudējumu apjoms” ierakstus no AutoDNA PDF teksta. */
export function parseAutodnaDamageEvents(raw: string): LtabIncidentRow[] {
  const text = sanitizePdfTextForParsing(raw);
  if (!autodnaDamageSectionDetected(text)) return [];

  const rows: LtabIncidentRow[] = [];
  let m: RegExpExecArray | null;
  AUTODNA_DAMAGE_EVENT_RE.lastIndex = 0;
  while ((m = AUTODNA_DAMAGE_EVENT_RE.exec(text)) !== null) {
    const month = m[1] ?? "";
    const year = m[2] ?? "";
    const sumRaw = (m[3] ?? "").replace(/\u00a0/g, " ").trim();
    const countryRaw = (m[4] ?? "").replace(/\s+/g, " ").trim();
    if (!month || !year || !sumRaw) continue;

    const csngDate = monthYearToDateDisplay(month, year);
    const lossAmount = normalizeLossAmountEurDisplay(`${sumRaw} EUR`);
    if (!lossAmount) continue;

    rows.push({
      csngDate,
      lossAmount,
      incidentNo: normalizeCountryNameLv(countryRaw) || countryRaw,
    });
  }

  return dedupeIncidents(rows);
}
