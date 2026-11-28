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
  ccVinServiceRowHasData,
  ccVinSpecRowHasData,
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
  type CcVinServiceRow,
  type CcVinSpecRow,
  type CcVinTitleRow,
} from "@/lib/cc-vin-report";
import { applyCcVinDefaultCommentPolicy } from "@/lib/admin-cc-vin-comment-presets";

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

  const salesIncoming = parsed.sales;
  const existingSales = (base.sales ?? []).filter(ccVinSaleRowHasData);
  const stubSales = existingSales.filter((r) => !r.date.trim() && !r.odometer.trim() && !r.venue.trim());
  const keptSales = existingSales.filter((r) => r.date.trim() || r.odometer.trim() || r.venue.trim());
  const incomingComplete = salesIncoming.some((r) => r.date.trim() || r.odometer.trim() || r.venue.trim());
  const stubsToKeep = incomingComplete ? [] : stubSales;

  const sales = byDateDesc(
    mergeRows<CcVinSaleRow>(
      [...keptSales, ...stubsToKeep],
      salesIncoming,
      ccVinSaleRowHasData,
      (r) => `${r.date}|${r.odometer}|${squish(r.venue)}`,
      emptyCcVinSaleRow,
    ),
  );

  // Servisi / «Citi dati»: tikai, ja atskaitē tādi ir (PDF parseris tos nelasa - esošie paliek).
  const servicesIncoming = (parsed.services ?? []).filter(ccVinServiceRowHasData);
  // Avotā var būt divi vienādi ieraksti tajā pašā dienā (BMW 01.10.2018: divas aizmugures pneimoatsperes) -
  // atslēgā arī kārtas numurs, lai tie paliek abi, bet atkārtots imports nedublē.
  const serviceKeys = (rows: CcVinServiceRow[]) => {
    const n = new Map<string, number>();
    return rows.map((r) => {
      const k = `${r.date}|${squish(r.description)}`;
      const i = (n.get(k) ?? 0) + 1;
      n.set(k, i);
      return `${k}#${i}`;
    });
  };
  let services = base.services;
  if (servicesIncoming.length) {
    const existing = (base.services ?? []).filter(ccVinServiceRowHasData);
    const seen = new Set(serviceKeys(existing));
    const incomingKeys = serviceKeys(servicesIncoming);
    services = byDateDesc([...existing, ...servicesIncoming.filter((_, i) => !seen.has(incomingKeys[i]!))]);
  }
  const specsIncoming = (parsed.specs ?? []).filter(ccVinSpecRowHasData);
  const specs = specsIncoming.length
    ? mergeRows<CcVinSpecRow>(
        (base.specs ?? []).filter((r) => !specsIncoming.some((n) => squish(n.label) === squish(r.label))),
        specsIncoming,
        ccVinSpecRowHasData,
        (r) => `${squish(r.label)}|${squish(r.value)}`,
        () => ({ label: "", value: "" }),
      ).filter(ccVinSpecRowHasData)
    : base.specs;

  return applyCcVinDefaultCommentPolicy(
    {
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
      ...(services?.length ? { services } : {}),
      ...(specs?.length ? { specs } : {}),
    },
    base,
  );
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
  if ((parsed.services?.length ?? 0) > 0) counts.push(`${parsed.services!.length} servisa ieraksti`);
  if ((parsed.specs?.length ?? 0) > 0) counts.push(`${parsed.specs!.length} citi dati`);
  if (counts.length > 0) parts.push(counts.join(", "));
  return parts.length > 0 ? `Starptautiskā vēsture: ${parts.join(" · ")}.` : "Starptautiskā vēsture: nolasīta.";
}
