/**
 * CSDD pirmās reģistrācijas konsekvences pārbaudes.
 * Tikai admin brīdinājumi: vērtības neslabo.
 */

import {
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { ownerFirstRegistrationInLatvia } from "@/lib/csdd-extended-parse";

export type CsddFirstRegWarning = {
  id: string;
  message: string;
};

function dateMs(raw: string): number {
  return parseDotOrIsoDateToMs(raw);
}

function yearOf(raw: string): number | null {
  const iso = raw.trim();
  const m = iso.match(/(?:19|20)\d{2}/);
  if (!m) return null;
  const y = Number(m[0]);
  return Number.isFinite(y) ? y : null;
}

function sameDay(a: string, b: string): boolean {
  const ma = dateMs(a);
  const mb = dateMs(b);
  if (ma <= 0 || mb <= 0) return false;
  const da = new Date(ma);
  const db = new Date(mb);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

export function resolveCsddFirstRegistrationLatvia(csdd: Pick<
  CsddFormFields,
  "firstRegistrationLatvia" | "ownerRegistrationEvents"
>): string {
  const direct = csdd.firstRegistrationLatvia.trim();
  if (direct) return direct;
  return ownerFirstRegistrationInLatvia(csdd.ownerRegistrationEvents)?.date.trim() ?? "";
}

/** Datumi no citiem avotiem (AutoDNA, sludinājums, dīleris u.c.). */
export function collectWorkspaceRecordDates(blocks: WorkspaceSourceBlocks): string[] {
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    if (raw?.trim()) out.push(raw.trim());
  };
  for (const key of ["autodna", "carvertical"] as const) {
    const b = blocks[key];
    for (const r of b.serviceHistory ?? []) push(r.date);
    for (const r of b.vehicleHistoryTimeline ?? []) push(r.date);
    for (const r of b.incidents ?? []) push(r.csngDate);
  }
  for (const r of blocks.auto_records.serviceHistory ?? []) push(r.date);
  for (const w of blocks.auto_records.serviceWorks ?? []) push(w.date);
  for (const r of blocks.asv.mileage ?? []) push(r.date);
  for (const r of blocks.asv.sales ?? []) push(r.date);
  for (const r of blocks.asv.damages ?? []) push(r.date);
  for (const r of blocks.cc_vin.mileage ?? []) push(r.date);
  for (const r of blocks.cc_vin.sales ?? []) push(r.date);
  for (const r of blocks.cc_vin.damages ?? []) push(r.date);
  for (const section of blocks.citi_avoti.sections ?? []) {
    for (const r of section.serviceHistory ?? []) push(r.date);
    for (const r of section.vehicleHistoryTimeline ?? []) push(r.date);
  }
  push(blocks.tirgus.listingCreated);
  push(blocks.tirgus.listingMileageDate);
  for (const r of blocks.tirgus.priceHistory ?? []) push(r.date);
  return out;
}

/**
 * Pēc parse / Copilot: rāda adminam, ja pirmā reģistrācija pasaulē ir pretrunā ar datiem.
 * Neslabo laukus.
 */
export function collectCsddFirstRegistrationWarnings(args: {
  csdd: CsddFormFields;
  otherRecordDates?: string[];
}): CsddFirstRegWarning[] {
  const first = args.csdd.firstRegistration.trim();
  if (!first) return [];
  const firstMs = dateMs(first);
  const firstLv = resolveCsddFirstRegistrationLatvia(args.csdd);
  const prevCountry = args.csdd.previousRegistrationCountry.trim();
  const out: CsddFirstRegWarning[] = [];

  const recordDates = [
    firstLv,
    ...(args.csdd.ownerRegistrationEvents ?? []).map((e) => e.date),
    ...(args.csdd.mileageHistory ?? []).map((r) => r.date),
    ...(args.csdd.technicalInspectionHistory ?? []).map((r) => r.date),
    ...(args.otherRecordDates ?? []),
  ];
  let earliestMs = 0;
  let earliestRaw = "";
  for (const raw of recordDates) {
    const ms = dateMs(raw);
    if (ms <= 0) continue;
    if (earliestMs <= 0 || ms < earliestMs) {
      earliestMs = ms;
      earliestRaw = raw.trim();
    }
  }
  if (firstMs > 0 && earliestMs > 0 && firstMs > earliestMs) {
    out.push({
      id: "FR1",
      message: `Pirmā reģistrācija (pasaulē) ${first} ir vēlāka par agrāko ierakstu avotos (${earliestRaw}).`,
    });
  }

  const modelYear = yearOf(args.csdd.modelYear);
  const firstYear = yearOf(first);
  if (modelYear != null && firstYear != null && Math.abs(firstYear - modelYear) > 1) {
    out.push({
      id: "FR2",
      message: `Pirmā reģistrācija (pasaulē) ${first} atšķiras no izlaiduma gada ${modelYear} vairāk nekā par 1 gadu.`,
    });
  }

  if (prevCountry && firstLv && sameDay(first, firstLv)) {
    out.push({
      id: "FR3",
      message: `Ir iepriekšējās reģistrācijas valsts (${prevCountry}), tāpēc pirmā reģistrācija Latvijā (${firstLv}) nevar būt pirmā reģistrācija pasaulē.`,
    });
  }

  return out;
}
