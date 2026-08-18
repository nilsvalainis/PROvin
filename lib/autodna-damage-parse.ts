/**
 * AutoDNA PDF — „Transportlīdzekļa zaudējumu apjoms” (Summa diapazons + Valsts + MM.YYYY).
 */
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import type { CarVerticalDamageDetailRow } from "@/lib/carvertical-pdf-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { extractGroupListFromBlock, extractZoneListFromBlock } from "@/lib/damage-zones";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";

const DAMAGE_SECTION_HINT =
  /Transportlīdzekļa\s+zaudējumu\s+apjoms|Zaudējumu\s+apjoms/i;

const COUNTRY_STOP_RE = /\s+(?:Boj[āa]jumu|Deta[ļl]u|Rezult[āa]ts|Summa|Valsts)\b/i;

function clipAutodnaCountry(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  const cut = t.search(COUNTRY_STOP_RE);
  return (cut >= 0 ? t.slice(0, cut) : t).trim();
}

/** Viens negadījums: datums (MM.YYYY) … Summa … EUR … Valsts … */
const AUTODNA_DAMAGE_EVENT_RE =
  /(\d{1,2})\.(\d{4})[\s\S]{0,200}?zaudējumu\s+apjoms[\s\S]{0,450}?Summa\s+([\d\s\u00A0]+(?:\s*[-–—]\s*[\d\s\u00A0]+)?)\s*EUR[\s\S]{0,180}?Valsts\s+([A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž][A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž\s-]{1,48})/gi;

const EVENT_START_RE = /(\d{1,2})\.(\d{4})[\s\S]{0,600}?zaudējumu\s+apjoms/gi;

function monthYearToDateDisplay(month: string, year: string): string {
  const mo = month.padStart(2, "0");
  return formatAutoRecordsDateForOutput(`01.${mo}.${year}`);
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
  return DAMAGE_SECTION_HINT.test(text) || /Boj[āa]jumu\s+zonas?/i.test(text);
}

function collectAutodnaDamageStarts(text: string): { index: number; month: string; year: string }[] {
  const starts: { index: number; month: string; year: string }[] = [];
  const push = (index: number, month: string, year: string) => {
    if (!month || !year) return;
    if (starts.some((s) => Math.abs(s.index - index) < 48)) return;
    starts.push({ index, month, year });
  };
  EVENT_START_RE.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = EVENT_START_RE.exec(text)) !== null) {
    push(sm.index ?? 0, sm[1] ?? "", sm[2] ?? "");
  }
  const hintRe = /zaudējumu\s+apjoms|Boj[āa]jumu\s+zonas?/gi;
  while ((sm = hintRe.exec(text)) !== null) {
    const idx = sm.index ?? 0;
    const lookback = text.slice(Math.max(0, idx - 360), idx);
    const dates = [...lookback.matchAll(/(\d{1,2})\.(\d{4})/g)];
    const last = dates[dates.length - 1];
    if (!last) continue;
    const dateIndex = idx - lookback.length + (last.index ?? 0);
    push(dateIndex, last[1] ?? "", last[2] ?? "");
  }
  starts.sort((a, b) => a.index - b.index);
  return starts;
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
    const countryRaw = clipAutodnaCountry((m[4] ?? "").replace(/\s+/g, " ").trim());
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

/** AutoDNA „Bojājumu zona” / „Detaļu grupa” — visa saraksta saturs, ne tikai zināmas zonas. */
export function parseAutodnaDamageDetails(raw: string): CarVerticalDamageDetailRow[] {
  const text = sanitizePdfTextForParsing(raw);
  if (!autodnaDamageSectionDetected(text)) return [];

  const starts = collectAutodnaDamageStarts(text);

  const out: CarVerticalDamageDetailRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = starts[i + 1]?.index ?? text.length;
    const block = text.slice(start.index, end);
    const sumM = block.match(/Summa\s+([\d\s\u00A0]+(?:\s*[-–—]\s*[\d\s\u00A0]+)?)\s*EUR/i);
    const countryM = block.match(
      /Valsts\s+([A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž][A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž\s-]{1,48})/i,
    );
    const sumRaw = (sumM?.[1] ?? "").replace(/\u00a0/g, " ").trim();
    const lossAmount = sumRaw ? normalizeLossAmountEurDisplay(`${sumRaw} EUR`) : "";
    const countryRaw = clipAutodnaCountry((countryM?.[1] ?? "").replace(/\s+/g, " ").trim());
    const damagedSides = extractZoneListFromBlock(block);
    const damageGroups = extractGroupListFromBlock(block);
    if (!damagedSides && !damageGroups && !lossAmount) continue;
    const date = monthYearToDateDisplay(start.month, start.year);
    const row: CarVerticalDamageDetailRow = {
      date,
      country: normalizeCountryNameLv(countryRaw) || countryRaw,
      lossAmount,
      damagedSides,
      damageGroups,
    };
    const key = `${row.date}|${row.country}|${row.lossAmount}|${row.damagedSides}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
