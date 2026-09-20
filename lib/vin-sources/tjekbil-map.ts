/**
 * tjekbil.dk JSON → admin reģistra bloks.
 * inspectionData.rapporter ir Færdselsstyrelsen synsrapport (tie paši dati, ko fstyr.dk PDF).
 */
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import { asArray, asRecord, DK_COUNTRY_LV, isoDay, num, str } from "@/lib/vin-sources/dk-json";
import {
  capitalizeFactValue,
  capitalizeRegistryEvent,
  detectSpecialUseLabels,
  translateTermLv,
  translateTextLv,
} from "@/lib/vin-sources/translate-lv";
import type { VinSourceIncidentRow, VinSourceMileageRow } from "@/lib/vin-sources/types";

export type TjekbilDmrResponse = {
  basic?: Record<string, unknown>;
  extended?: {
    carId?: unknown;
    general?: Record<string, unknown>;
    insurance?: { selskab?: unknown; status?: unknown; oprettet?: unknown; historik?: unknown };
    inspection?: Record<string, unknown>;
  };
  inspectionData?: { rapporter?: unknown; mistaenkeligtKmStand?: unknown };
  debtData?: { laaneDokumenter?: unknown; konkurs?: unknown };
};

export type TjekbilMileageLog = { mileage?: unknown; mileageAt?: unknown; origin?: unknown; isHidden?: unknown };

export type TjekbilInspection = {
  synsdato?: unknown;
  synstype?: unknown;
  kategori?: unknown;
  synsresultat?: unknown;
  kmstand?: unknown;
  firma?: unknown;
  fejl?: unknown;
  remoteId?: unknown;
};

export type TjekbilTimelineRow = { date: string; odometer: string; country: string; event: string };

export type TjekbilMapped = {
  found: boolean;
  message: string;
  mileage: VinSourceMileageRow[];
  incidents: VinSourceIncidentRow[];
  timeline: TjekbilTimelineRow[];
  ownersSummary: string;
  statusRecords: string;
  notes: string[];
};

const MILEAGE_ORIGIN_LV: Record<number, string> = {
  10: "Færdselsstyrelsen (synsrapport)",
  20: "Motorstyrelsen (nodokļu reģistrs)",
  30: "Pirmā reģistrācija",
};

export function isCustomsInspection(r: TjekbilInspection): boolean {
  return /toldsyn/i.test(`${str(r.kategori)} ${str(r.synstype)}`);
}

/** Periodiskā / reģistrācijas apskate nav izturēta. Toldsyn „Middel” ir muitas vērtējums, ne MOT. */
export function isFailedMot(r: TjekbilInspection): boolean {
  if (isCustomsInspection(r)) return false;
  const result = str(r.synsresultat).trim();
  if (!result) return false;
  if (/godkendt/i.test(result)) return false;
  return /ikke|omsyn|kan ikke|betinget/i.test(result);
}

function inspectionsOf(dmr: TjekbilDmrResponse): TjekbilInspection[] {
  return asArray(dmr.inspectionData?.rapporter).map((r) => r as TjekbilInspection);
}

function insuranceHistory(dmr: TjekbilDmrResponse): Record<string, unknown>[] {
  return asArray(dmr.extended?.insurance?.historik).map(asRecord);
}

export type DkRegistrationSignal = { date: string; event: string };

const OWNER_TRANSFER_RE = /ejer|owner|omregistr|ejerskift|overdrag/i;
const DEREG_RE = /afmeld|udmeld/i;
const NOT_REG_TRANSFER_RE = /syn|forsikring|insurance|octa|kilometer|kmstand/i;

function statusHistorySignals(
  basic: Record<string, unknown>,
  mode: "owners" | "timeline" = "owners",
): DkRegistrationSignal[] {
  const out: DkRegistrationSignal[] = [];
  for (const item of asArray(basic.statusHistory)) {
    const rec = asRecord(item);
    const date = isoDay(rec.dato ?? rec.date ?? rec.statusDato ?? rec.statusdato);
    const blob = [str(rec.type), str(rec.status), str(rec.beskrivelse), str(rec.typeNavn), str(rec.kategori)].join(" ");
    if (!date || !blob.trim() || NOT_REG_TRANSFER_RE.test(blob)) continue;
    const isTransfer = OWNER_TRANSFER_RE.test(blob);
    const isDereg = DEREG_RE.test(blob);
    if (mode === "owners" && (isDereg || !isTransfer)) continue;
    if (mode === "timeline" && !isTransfer && !isDereg) continue;
    const event =
      translateTermLv(str(rec.typeNavn) || str(rec.type) || str(rec.status), "da") || blob.trim().slice(0, 80);
    out.push({ date, event });
  }
  return out;
}

function dkRegistreringssynDates(inspections: TjekbilInspection[]): string[] {
  const dates: string[] = [];
  for (const r of inspections) {
    if (isCustomsInspection(r)) continue;
    if (!/registreringssyn/i.test(`${str(r.kategori)} ${str(r.synstype)}`)) continue;
    const date = isoDay(r.synsdato);
    if (date) dates.push(date);
  }
  return dates;
}

/** Pirmā reģistrācija ir Dānijas īpašnieks tikai tad, ja auto nav importēts vēlāk. */
export function firstRegistrationIsDanish(dmr: TjekbilDmrResponse, inspections: TjekbilInspection[]): boolean {
  const firstReg = isoDay(dmr.basic?.foersteRegistreringDato);
  if (!firstReg) return false;
  if (inspections.some(isCustomsInspection)) return false;
  return !dkRegistreringssynDates(inspections).some((date) => date !== firstReg);
}

function addIsoDays(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

function minIsoDay(dates: string[]): string {
  const ok = dates.filter(Boolean).sort();
  return ok[0] ?? "";
}

function maxIsoDay(dates: string[]): string {
  const ok = dates.filter(Boolean).sort();
  return ok[ok.length - 1] ?? "";
}

function mergedLeaseSpans(basic: Record<string, unknown>): { from: string; to: string }[] {
  const raw = leasingPeriods(basic)
    .map((p) => ({ from: p.from, to: p.to || p.from }))
    .filter((p) => p.from)
    .sort((a, b) => a.from.localeCompare(b.from));
  const out: { from: string; to: string }[] = [];
  for (const p of raw) {
    const prev = out[out.length - 1];
    if (prev && p.from <= addIsoDays(prev.to, 7)) {
      if (p.to > prev.to) prev.to = p.to;
    } else {
      out.push({ from: p.from, to: p.to });
    }
  }
  return out;
}

function occupancyPhaseLabel(
  date: string,
  kind: "lease" | "private",
  dmr: TjekbilDmrResponse,
  inspections: TjekbilInspection[],
): string {
  if (kind === "lease") return "Līzings Dānijā";
  const firstReg = isoDay(dmr.basic?.foersteRegistreringDato);
  if (firstReg && date === firstReg && firstRegistrationIsDanish(dmr, inspections)) {
    return "Pirmā reģistrācija Dānijā";
  }
  if (dkRegistreringssynDates(inspections).includes(date)) return "Reģistrācija Dānijā";
  return "Privāta reģistrācija Dānijā";
}

/**
 * Dānijas īpašnieku fāzes: nepārtraukts līzings = 1, privāta reģistrācija pirms/pēc = atsevišķi.
 * Ārvalstu pirmā reģistrācija, OCTA un atsevišķi līzinga līgumi nav jauns īpašnieks.
 */
export function extractDkRegistrationSignals(
  dmr: TjekbilDmrResponse,
  inspections: TjekbilInspection[],
): DkRegistrationSignal[] {
  const basic = dmr.basic ?? {};
  const leases = mergedLeaseSpans(basic);
  const firstReg = isoDay(basic.foersteRegistreringDato);
  const dkFirstReg = firstReg && firstRegistrationIsDanish(dmr, inspections) ? firstReg : "";
  const synDates = dkRegistreringssynDates(inspections);
  const inspDates = inspections
    .filter((r) => !isCustomsInspection(r))
    .map((r) => isoDay(r.synsdato))
    .filter(Boolean);
  const dkStart = minIsoDay([dkFirstReg, ...synDates, ...leases.map((l) => l.from), ...inspDates]);
  const rows: DkRegistrationSignal[] = [];
  if (!dkStart) return rows;

  const dkEnd = maxIsoDay([isoDay(basic.statusDato), ...inspDates, ...leases.map((l) => l.to), dkStart]);
  let cursor = dkStart;
  for (const lease of leases) {
    if (lease.to < dkStart || lease.from > dkEnd) continue;
    const leaseFrom = lease.from < dkStart ? dkStart : lease.from;
    if (leaseFrom > cursor) {
      rows.push({ date: cursor, event: occupancyPhaseLabel(cursor, "private", dmr, inspections) });
    }
    rows.push({ date: leaseFrom, event: occupancyPhaseLabel(leaseFrom, "lease", dmr, inspections) });
    cursor = addIsoDays(lease.to, 1);
  }
  if (cursor && dkEnd && cursor <= dkEnd) {
    rows.push({ date: cursor, event: occupancyPhaseLabel(cursor, "private", dmr, inspections) });
  }

  if (dkFirstReg && !rows.some((s) => s.date === dkFirstReg)) {
    rows.push({ date: dkFirstReg, event: "Pirmā reģistrācija Dānijā" });
  }
  for (const date of synDates) {
    if (rows.some((s) => s.date === date)) continue;
    rows.push({ date, event: "Reģistrācija Dānijā" });
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.date}|${row.event}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function leasingPeriods(basic: Record<string, unknown>): { from: string; to: string }[] {
  const rows: { from: string; to: string }[] = [];
  const history = asArray(basic.leasingHistory);
  for (const item of history) {
    const rec = asRecord(item);
    const from = isoDay(rec.leasingGyldigFra);
    const to = isoDay(rec.leasingGyldigTil);
    if (from || to) rows.push({ from, to });
  }
  if (rows.length === 0) {
    const from = isoDay(basic.leasingGyldigFra);
    const to = isoDay(basic.leasingGyldigTil);
    if (from || to) rows.push({ from, to });
  }
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.from}|${r.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasLaterDkImport(inspections: TjekbilInspection[]): boolean {
  return inspections.some(isCustomsInspection);
}

function inspectionKm(r: TjekbilInspection): string {
  const km = num(r.kmstand);
  return km != null && km >= 0 ? String(km) : "";
}

function inspectionEvent(r: TjekbilInspection): string {
  const kategori = translateTermLv(str(r.kategori), "da") || str(r.kategori);
  const result = translateTermLv(str(r.synsresultat), "da") || str(r.synsresultat);
  const place = str(r.firma).trim();
  if (isCustomsInspection(r)) {
    const grade = result || "nav norādīts";
    const detail = [`stāvoklis ${grade}`, place].filter(Boolean).join(" · ");
    return detail ? `Muitas apskate (imports): ${detail}` : "Muitas apskate (imports)";
  }
  const kind = kategori || translateTermLv(str(r.synstype), "da") || "Tehniskā apskate";
  const detail = [result, place].filter(Boolean).join(" · ");
  return detail ? `${kind}: ${detail}` : kind;
}

export function buildTjekbilMileage(logs: TjekbilMileageLog[], inspections: TjekbilInspection[]): VinSourceMileageRow[] {
  const rows: VinSourceMileageRow[] = [];
  for (const log of logs) {
    if (log.isHidden === true) continue;
    const km = num(log.mileage);
    const date = isoDay(log.mileageAt);
    if (km == null || !date) continue;
    rows.push({
      date,
      odometer: String(km),
      country: DK_COUNTRY_LV,
      origin: MILEAGE_ORIGIN_LV[num(log.origin) ?? -1] ?? "DMR",
    });
  }
  for (const r of inspections) {
    const km = inspectionKm(r);
    const date = isoDay(r.synsdato);
    if (!km || !date) continue;
    const origin = isCustomsInspection(r)
      ? "Færdselsstyrelsen (muitas apskate)"
      : `Færdselsstyrelsen (synsrapport) — ${translateTermLv(str(r.synsresultat), "da") || str(r.synsresultat)}`;
    rows.push({ date, odometer: km, country: DK_COUNTRY_LV, origin });
  }

  const merged: VinSourceMileageRow[] = [];
  for (const row of rows.sort((a, b) => a.date.localeCompare(b.date))) {
    const dup = merged.find(
      (m) =>
        m.odometer === row.odometer &&
        Math.abs(new Date(m.date).getTime() - new Date(row.date).getTime()) <= 3 * 24 * 3600 * 1000,
    );
    if (dup) {
      if (row.origin && !dup.origin?.includes(row.origin)) dup.origin = [dup.origin, row.origin].filter(Boolean).join("; ");
      continue;
    }
    merged.push({ ...row });
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildTjekbilIncidents(dmr: TjekbilDmrResponse, inspections: TjekbilInspection[]): VinSourceIncidentRow[] {
  const rows: VinSourceIncidentRow[] = [];
  for (const r of inspections) {
    if (!isFailedMot(r)) continue;
    const faults = asArray(r.fejl).map(asRecord);
    const faultText = faults
      .map((f) => [str(f.title), str(f.description)].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" | ");
    rows.push({
      date: isoDay(r.synsdato),
      amount: "",
      country: DK_COUNTRY_LV,
      note: `Apskate nav izturēta (${translateTermLv(str(r.synsresultat), "da")})${faultText ? ` — ${translateTextLv(faultText, "da")}` : ""}`,
    });
  }

  const debts = asArray(dmr.debtData?.laaneDokumenter).map(asRecord);
  for (const d of debts) {
    rows.push({
      date: isoDay(d.dato ?? d.date),
      amount: str(d.beloeb ?? d.amount),
      country: DK_COUNTRY_LV,
      note: `Ķīla / parāds (Bilbogen)${str(d.kreditor ?? d.creditor) ? ` — ${str(d.kreditor ?? d.creditor)}` : ""}`,
    });
  }
  return rows;
}

export function buildTjekbilTimeline(dmr: TjekbilDmrResponse, inspections: TjekbilInspection[]): TjekbilTimelineRow[] {
  const basic = dmr.basic ?? {};
  const rows: TjekbilTimelineRow[] = [];
  const push = (date: string, event: string, odometer = "", country = DK_COUNTRY_LV) => {
    if (!date || !event) return;
    rows.push({ date, odometer, country, event: capitalizeRegistryEvent(event) });
  };

  const firstReg = isoDay(basic.foersteRegistreringDato);
  if (firstReg) {
    const abroad = hasLaterDkImport(inspections);
    push(firstReg, "Pirmā reģistrācija", "", abroad ? "" : DK_COUNTRY_LV);
  }

  for (const r of inspections) {
    push(isoDay(r.synsdato), inspectionEvent(r), inspectionKm(r));
  }

  for (const period of leasingPeriods(basic)) {
    if (period.from) push(period.from, "Līzings sākas");
    if (period.to) push(period.to, "Līzings beidzas");
  }

  for (const s of statusHistorySignals(basic, "timeline")) {
    push(s.date, `Reģistrācijas darbība: ${s.event}`);
  }

  for (const h of insuranceHistory(dmr)) {
    const when = isoDay(h.oprettet);
    const company = str(h.selskab);
    const status = translateTermLv(str(h.status), "da") || str(h.status);
    const parts = [company, status].filter(Boolean).join(", ");
    if (when && parts) push(when, `Apdrošināšana: ${parts}`);
  }

  const statusDate = isoDay(basic.statusDato);
  const status = translateTermLv(str(basic.status), "da");
  if (statusDate && status) push(statusDate, `Reģistrācijas statuss: ${status}`);

  const seen = new Set<string>();
  const out: TjekbilTimelineRow[] = [];
  for (const row of rows.sort((a, b) => b.date.localeCompare(a.date))) {
    const key = `${row.date}|${row.event}|${row.odometer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function buildTjekbilOwnersSummary(dmr: TjekbilDmrResponse, inspections: TjekbilInspection[]): string {
  const signals = extractDkRegistrationSignals(dmr, inspections);
  if (signals.length === 0) return "";
  const n = new Set(signals.map((s) => s.date)).size;
  return `Īpašnieku skaits Dānijā: ${n}.`;
}

export function buildTjekbilStatusRecords(dmr: TjekbilDmrResponse): { text: string; specialUse: string[] } {
  const basic = dmr.basic ?? {};
  const general = dmr.extended?.general ?? {};
  const inspection = dmr.extended?.inspection ?? {};
  const insurance = dmr.extended?.insurance;
  const lines: string[] = [];

  const use = str(basic.koeretoejAnvendelseNavn) || str(general.koeretoejAnvendelse);
  if (use) lines.push(`Izmantošanas veids: ${capitalizeFactValue(translateTermLv(use, "da"))}`);

  const fuel =
    str(basic.drivkraft) ||
    str(basic.koeretoejMotorDrivkraftNavn) ||
    str(general.drivkraft) ||
    str(general.drivmiddel);
  if (fuel) lines.push(`Degviela: ${capitalizeFactValue(translateTermLv(fuel, "da"))}`);

  const powerRaw = str(basic.motoreffekt) || str(basic.effekt) || str(general.effekt);
  const driveRaw =
    str(basic.koeretoejMotorKoeretoejTraekNavn) ||
    str(basic.traek) ||
    str(general.traek) ||
    str(general.koeretoejTraek);
  const power = [translateTextLv(powerRaw, "da"), translateTermLv(driveRaw, "da") || translateTextLv(driveRaw, "da")]
    .filter(Boolean)
    .filter((part, i, all) => i === 0 || !all[0]!.toLocaleLowerCase("lv").includes(part.toLocaleLowerCase("lv")))
    .join(" · ");
  if (power) lines.push(`Jauda / piedziņa: ${capitalizeFactValue(power)}`);

  const periods = leasingPeriods(basic);
  if (basic.bilLeaset === true) {
    lines.push("Līzings: Aktīvs");
  } else if (periods.length > 0) {
    const first = periods[0]!;
    const last = periods[periods.length - 1]!;
    const span = [first.from, last.to].filter(Boolean).map(formatRegistryDateLv).join(" - ");
    lines.push(`Līzings: ${span || "bijis"}${periods.length > 1 ? ` (${periods.length} periodi)` : ""}`);
  }

  const status = translateTermLv(str(basic.status), "da");
  const statusDate = isoDay(basic.statusDato);
  if (status) {
    lines.push(
      `Reģistrācijas statuss: ${capitalizeFactValue(`${status}${statusDate ? ` (${formatRegistryDateLv(statusDate)})` : ""}`)}`,
    );
  }

  const secondary = str(general.sekundaerStatus);

  const importCondition = str(general.standEfterImport) || str(basic.koeretoejstand);
  if (importCondition) {
    lines.push(`Stāvoklis pēc importa: ${capitalizeFactValue(translateTextLv(importCondition, "da"))}`);
  }

  const lastSyn = isoDay(inspection.sidsteSyn);
  const lastResult = translateTermLv(str(inspection.sidsteSynResultat), "da");
  if (lastSyn) {
    lines.push(
      `Pēdējā apskate: ${capitalizeFactValue(`${formatRegistryDateLv(lastSyn)}${lastResult ? `, ${lastResult}` : ""}`)}`,
    );
  }
  const nextSyn = isoDay(inspection.naesteSyn);
  if (nextSyn) lines.push(`Nākamā apskate (DK): ${formatRegistryDateLv(nextSyn)}`);

  const currentInsurer = str(insurance?.selskab);
  if (currentInsurer) {
    const insStatus = translateTermLv(str(insurance?.status), "da");
    lines.push(
      `Pašreizējā OCTA: ${capitalizeFactValue(`${currentInsurer}${insStatus ? ` (${insStatus})` : ""}`)}`,
    );
  }

  const permissions = asArray(basic.permissions).map(asRecord);
  const specialUse = detectSpecialUseLabels([use, secondary, ...permissions.map((p) => str(p.typeNavn))].join(" "));
  if (specialUse.length > 0) lines.push(`Īpašie statusi: ${specialUse.join(", ")}`);

  return { text: lines.join("\n"), specialUse };
}

export function buildTjekbilNotes(
  mileage: VinSourceMileageRow[],
  dmr: TjekbilDmrResponse,
  inspections: TjekbilInspection[],
  wanted: unknown[],
  specialUse: string[],
  rapex: unknown,
): string[] {
  const notes: string[] = [];

  const asc = [...mileage].sort((a, b) => a.date.localeCompare(b.date));
  let peak: VinSourceMileageRow | null = null;
  for (const row of asc) {
    const km = Number(row.odometer);
    const peakKm = peak ? Number(peak.odometer) : -1;
    if (peak && km < peakKm - 1000) {
      notes.push(
        `Odometra pretruna: ${peakKm.toLocaleString("lv-LV")} km (${formatRegistryDateLv(peak.date)}), pēc tam ${km.toLocaleString("lv-LV")} km (${formatRegistryDateLv(row.date)}).`,
      );
    }
    if (!peak || km > peakKm) peak = row;
  }

  for (const label of specialUse) notes.push(`Īpašais statuss: ${label}.`);

  const failed = inspections.filter((r) => !isCustomsInspection(r) && isFailedMot(r));
  if (failed.length > 0) notes.push(`Neizturētas apskates: ${failed.length}.`);

  if (dmr.inspectionData?.mistaenkeligtKmStand === true) {
    notes.push("tjekbil.dk atzīmē aizdomīgu odometra rindu.");
  }

  const debtCount = asArray(dmr.debtData?.laaneDokumenter).length;
  if (debtCount > 0) notes.push("Reģistrēta ķīla (Bilbogen).");
  if (dmr.debtData?.konkurs) notes.push("Maksātnespējas atzīme.");
  if (Array.isArray(wanted) && wanted.length > 0) notes.push("Ieraksts meklēto transportlīdzekļu vēsturē.");
  if (dmr.extended?.general?.blockedStatus === true) notes.push("Reģistrā bloķēts.");

  const rapexItems = asArray(rapex);
  if (rapexItems.length > 0) {
    notes.push(`RAPEX / atsaukumu ieraksti: ${rapexItems.length} (skat. RAW).`);
  }

  return notes;
}

export function mapTjekbilPayload(input: {
  dmr: TjekbilDmrResponse;
  mileagelogs?: TjekbilMileageLog[] | null;
  wanted?: unknown[] | null;
  rapex?: unknown;
}): TjekbilMapped {
  const { dmr } = input;
  const basic = dmr.basic ?? {};
  const inspections = inspectionsOf(dmr);
  const mileage = buildTjekbilMileage(input.mileagelogs ?? [], inspections);
  const incidents = buildTjekbilIncidents(dmr, inspections);
  const { text: statusRecords, specialUse } = buildTjekbilStatusRecords(dmr);
  const notes = buildTjekbilNotes(mileage, dmr, inspections, input.wanted ?? [], specialUse, input.rapex);

  const vehicle = [str(basic.maerkeTypeNavn), str(basic.modelTypeNavn), str(basic.variantTypeNavn)]
    .filter(Boolean)
    .join(" ");
  const regNr = str(basic.regNr);

  return {
    found: true,
    message: `Atrasts Dānijas reģistrā (tjekbil.dk = DMR + Færdselsstyrelsen synsrapport)${vehicle ? `: ${vehicle}` : ""}${regNr ? ` · ${regNr}` : ""}`,
    mileage,
    incidents,
    timeline: buildTjekbilTimeline(dmr, inspections),
    ownersSummary: buildTjekbilOwnersSummary(dmr, inspections),
    statusRecords,
    notes,
  };
}

export function tjekbilKid(dmr: TjekbilDmrResponse): number | null {
  const basic = dmr.basic ?? {};
  const carIdFallback = Number(str(dmr.extended?.carId));
  return (
    num(basic.koeretoejId) ??
    num(dmr.extended?.general?.kid) ??
    (Number.isFinite(carIdFallback) && carIdFallback > 0 ? carIdFallback : null)
  );
}

export function tjekbilPlate(dmr: TjekbilDmrResponse): string {
  return str(dmr.basic?.regNr).replace(/\s+/g, "");
}
