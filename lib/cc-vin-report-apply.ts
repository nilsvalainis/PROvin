/**
 * Parsētās starptautiskās vēstures atskaites iekļaušana admin blokā.
 *
 * Atkārtota tā paša PDF augšupielāde nedublē rindas: katrai tabulai ir sava identitātes atslēga,
 * un jau esošās operatora rindas paliek neskartas.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { autoRecordsRowHasData, formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import type { CcVinParsedReport } from "@/lib/cc-vin-report-parse";
import {
  ccVinDamageRowHasData,
  ccVinRecordRowHasData,
  ccVinSaleRowHasData,
  ccVinTitleRowHasData,
  emptyCcVinBlock,
  emptyCcVinDamageRow,
  emptyCcVinMileageRow,
  emptyCcVinRecordRow,
  emptyCcVinSaleRow,
  emptyCcVinTitleRow,
  type CcVinBlockState,
  type CcVinDamageRow,
  type CcVinRecordRow,
  type CcVinSaleRow,
  type CcVinTitleRow,
} from "@/lib/cc-vin-report";

function squish(v: string): string {
  return v.replace(/\s+/g, " ").trim().toLowerCase();
}

function sortableDate(raw: string): number {
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function mergeRows<T>(
  existing: T[],
  incoming: T[],
  hasData: (r: T) => boolean,
  key: (r: T) => string,
  fallback: () => T,
): T[] {
  const out: T[] = existing.filter(hasData);
  const seen = new Set(out.map(key));
  for (const row of incoming) {
    if (!hasData(row)) continue;
    const k = key(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out.length > 0 ? out : [fallback()];
}

function byDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => sortableDate(b.date) - sortableDate(a.date));
}

/**
 * Ieliek parsētos datus blokā. `prev` ir esošais bloka stāvoklis (operatora labojumi paliek),
 * bet galvenes lauki (atskaites datums, atzīmes, īpašnieki) tiek atjaunoti no jaunākās atskaites.
 */
export function applyCcVinParsedReport(
  parsed: CcVinParsedReport,
  prev: CcVinBlockState | null | undefined,
): CcVinBlockState {
  const base = prev ?? emptyCcVinBlock();

  const mileageIncoming: AutoRecordsServiceRow[] = parsed.mileage.map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date) || r.date,
    odometer: r.odometer,
    country: r.country,
  }));

  const mileage = byDateDesc(
    mergeRows(
      base.mileage ?? [],
      mileageIncoming,
      autoRecordsRowHasData,
      (r) => `${r.date}|${r.odometer}`,
      emptyCcVinMileageRow,
    ),
  );

  const damages = byDateDesc(
    mergeRows<CcVinDamageRow>(
      base.damages ?? [],
      parsed.damages,
      ccVinDamageRowHasData,
      (r) => `${r.date}|${squish(r.description)}`,
      emptyCcVinDamageRow,
    ),
  );

  const records = (existing: CcVinRecordRow[], incoming: CcVinRecordRow[]) =>
    byDateDesc(
      mergeRows<CcVinRecordRow>(
        existing,
        incoming,
        ccVinRecordRowHasData,
        (r) => `${r.date}|${squish(r.label)}|${squish(r.detail)}`,
        emptyCcVinRecordRow,
      ),
    );

  const titles = byDateDesc(
    mergeRows<CcVinTitleRow>(
      base.titles ?? [],
      parsed.titles,
      ccVinTitleRowHasData,
      (r) => `${r.date}|${r.odometer}|${squish(r.region)}`,
      emptyCcVinTitleRow,
    ),
  );

  const sales = byDateDesc(
    mergeRows<CcVinSaleRow>(
      base.sales ?? [],
      parsed.sales,
      ccVinSaleRowHasData,
      (r) => `${r.date}|${r.odometer}|${squish(r.venue)}`,
      emptyCcVinSaleRow,
    ),
  );

  return {
    ...base,
    reportDate: parsed.reportDate || base.reportDate,
    attentionMarks: parsed.attentionMarks || base.attentionMarks,
    ownersCount: parsed.ownersCount || base.ownersCount,
    checks: parsed.checks.length > 0 ? parsed.checks : base.checks,
    mileage,
    damages,
    insurance: records(base.insurance ?? [], parsed.insurance),
    brands: records(base.brands ?? [], parsed.brands),
    titles,
    sales,
  };
}

/** Kopsavilkums operatoram pēc PDF nolasīšanas. */
export function describeCcVinParsedReport(parsed: CcVinParsedReport): string {
  const parts: string[] = [];
  if (parsed.vehicleLine) parts.push(parsed.vehicleLine);
  if (parsed.attentionMarks) parts.push(`atzīmes ${parsed.attentionMarks}`);
  const counts: string[] = [];
  if (parsed.mileage.length > 0) counts.push(`${parsed.mileage.length} odometra ieraksti`);
  if (parsed.damages.length > 0) counts.push(`${parsed.damages.length} bojājumi`);
  if (parsed.brands.length > 0) counts.push(`${parsed.brands.length} īpašumtiesību atzīmes`);
  if (parsed.insurance.length > 0) counts.push(`${parsed.insurance.length} apdrošinātāju ieraksti`);
  if (parsed.titles.length > 0) counts.push(`${parsed.titles.length} title ieraksti`);
  if (parsed.sales.length > 0) counts.push(`${parsed.sales.length} pārdošanas`);
  if (counts.length > 0) parts.push(counts.join(", "));
  return parts.length > 0 ? `Starptautiskā vēsture: ${parts.join(" · ")}.` : "Starptautiskā vēsture: nolasīta.";
}
