/**
 * Latvijā reģistrācijas ilgums — no CSDD, AutoDNA/CarVertical un LTAB datiem.
 */

import {
  csddMileageRowHasData,
  ltabRowHasData,
  type AutoRecordsBlockState,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import { autoRecordsRowHasData, formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import { isLatviaCountryName } from "@/lib/country-names-lv";
import { parseMileageDateForSort } from "@/lib/unified-mileage";

export type LatviaRegistrationTenure = {
  firstDateDisplay: string;
  daysRegistered: number;
  sentence: string;
  sourceLabels: string[];
};

export type LatviaRegistrationTenureInput = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  referenceDate?: Date;
};

type DateCandidate = { sortable: number; dateRaw: string; source: string };

function pushCandidate(out: DateCandidate[], dateRaw: string, source: string): void {
  const t = dateRaw.trim();
  if (!t) return;
  const sortable = parseMileageDateForSort(t);
  if (sortable === Number.NEGATIVE_INFINITY) return;
  out.push({ sortable, dateRaw: t, source });
}

function formatDisplayDate(raw: string): string {
  return formatAutoRecordsDateForOutput(raw) || raw.trim();
}

function daysBetweenUtc(fromMs: number, toMs: number): number {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  const from = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const to = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function formatSourceList(labels: string[]): string {
  const uniq = [...new Set(labels)];
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return uniq[0]!;
  if (uniq.length === 2) return `${uniq[0]} un ${uniq[1]}`;
  return `${uniq.slice(0, -1).join(", ")} un ${uniq[uniq.length - 1]}`;
}

function collectLatviaFixedDates(input: LatviaRegistrationTenureInput): DateCandidate[] {
  const out: DateCandidate[] = [];

  for (const r of input.csddForm?.mileageHistory ?? []) {
    if (!csddMileageRowHasData(r)) continue;
    if (isLatviaCountryName(r.country)) pushCandidate(out, r.date, "CSDD");
  }

  for (const r of input.autoRecordsBlock?.serviceHistory ?? []) {
    if (!autoRecordsRowHasData(r)) continue;
    if (isLatviaCountryName(r.country)) pushCandidate(out, r.date, "AUTO RECORDS");
  }

  for (const b of input.manualVendorBlocks ?? []) {
    for (const r of b.mileageRows ?? []) {
      if (!autoRecordsRowHasData(r)) continue;
      if (isLatviaCountryName(r.country)) pushCandidate(out, r.date, b.title);
    }
  }

  for (const r of input.manualLtabBlock?.rows ?? []) {
    if (!ltabRowHasData(r)) continue;
    pushCandidate(out, r.csngDate, "LTAB");
  }

  return out;
}

/** Aprēķina reģistrācijas ilgumu Latvijā; `null`, ja nav datu. */
export function computeLatviaRegistrationTenure(
  input: LatviaRegistrationTenureInput,
): LatviaRegistrationTenure | null {
  const candidates = collectLatviaFixedDates(input);
  if (candidates.length === 0) return null;

  const oldest = candidates.reduce((a, b) => (a.sortable <= b.sortable ? a : b));
  const ref = input.referenceDate ?? new Date();
  const days = daysBetweenUtc(oldest.sortable, ref.getTime());
  const firstDateDisplay = formatDisplayDate(oldest.dateRaw);

  const usedSources = [...new Set(candidates.map((c) => c.source))];
  const sourceText = formatSourceList(usedSources);

  const sentence = sourceText
    ? `Saskaņā ar ${sourceText} datos fiksētajiem ierakstiem transportlīdzeklis Latvijā ir uzskaitē vismaz kopš ${firstDateDisplay} — kopā ${days} dienas.`
    : `Transportlīdzeklis Latvijā ir uzskaitē vismaz kopš ${firstDateDisplay} — kopā ${days} dienas.`;

  return {
    firstDateDisplay,
    daysRegistered: days,
    sentence,
    sourceLabels: usedSources,
  };
}
