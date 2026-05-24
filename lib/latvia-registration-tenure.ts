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
  monthsRegistered: number;
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

function monthsBetweenUtc(fromMs: number, toMs: number): number {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function lvDienaForm(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "diena";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "dienas";
  return "dienu";
}

function lvMenesisForm(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "mēnesis";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "mēneši";
  return "mēnešu";
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
  const months = monthsBetweenUtc(oldest.sortable, ref.getTime());
  const firstDateDisplay = formatDisplayDate(oldest.dateRaw);
  const usedSources = [...new Set(candidates.map((c) => c.source))];

  const sentence = `Saskaņā ar mūsu rīcībā esošajiem datiem transportlīdzeklis Latvijā ir reģistrēts — kopā ${days} ${lvDienaForm(days)} (${months} ${lvMenesisForm(months)}).`;

  return {
    firstDateDisplay,
    daysRegistered: days,
    monthsRegistered: months,
    sentence,
    sourceLabels: usedSources,
  };
}
