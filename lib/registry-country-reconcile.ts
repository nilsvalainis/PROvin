/**
 * 26.11 (Mercedes SE→DK→LV): ārvalstu reģistru bloku valstu saskaņošana.
 * Patiesība: SE 12.2010-10.2016, DK 27.10.2016 (imports) - 09.2026, LV no 11.2026. Avotu dati bija pareizi,
 * kļūdas bija mūsu interpretācijā:
 * - DMR `foersteRegistreringDato` ir pirmā reģistrācija jebkurā valstī - ja ir Dānijas importa muitas apskate,
 *   tā nav Dānijas fakts;
 * - car.info (Zviedrijas cilne) pēc eksporta rāda Dānijas DMR datus ar Zviedrijas karogu
 *   («latest known registration number DK …»).
 *
 * `reconcileRegistryBlockCountries` - nedestruktīvi (tikai valsts lauks + no RAW atvasinātie teksti), to lieto
 * `mergeSourceBlocksWithDefaults`. `registryBlockDisplayView` - tikai atskaitei / laikjoslai: dublikātus, ko jau
 * rāda attiecīgās valsts reģistrs, izlaiž; Dānijas līzinga / OCTA troksni apvieno.
 */
import type { VinRegistryBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { collapseDkLeaseInsuranceRows } from "@/lib/vin-sources/dk-lease-timeline";
import { translateStoredCarinfoEvent } from "@/lib/vin-sources/carinfo-parse";
import { tjekbilDerivedFromRaw } from "@/lib/vin-sources/tjekbil-map";

export const REGISTRY_HOME_COUNTRY = {
  carinfo: "Zviedrija",
  traficom_fi: "Somija",
  tjekbil: "Dānija",
  mnt_ee: "Igaunija",
  lkf_ee: "Igaunija",
  finnik: "Nīderlande",
} as const;

export type ReconcileRegistryKey = keyof typeof REGISTRY_HOME_COUNTRY;
const KEYS = Object.keys(REGISTRY_HOME_COUNTRY) as ReconcileRegistryKey[];

const FIRST_REGISTRATION_RE = /pirm\p{L}*\s+reģistrācij|first\s+registration/iu;
const IMPORT_EVENT_RE = /muitas apskate \(imports\)|importēts|\bimports?\b|ievests/iu;
const EXPORT_EVENT_RE = /eksport|export|izvests/iu;
const FOREIGN_PLATE_RE = /Pēdējais zināmais reģistrācijas numurs:\s*[A-Z]{1,3}\s+[A-Z0-9]{2,10}\s*\(([^)]+)\)/u;
/** Dublikāts citas valsts reģistrā: ±3 dienas (car.info DK spogulis 26.09 pret DMR 24.09). */
const DUP_DAYS = 3;
const DUP_KM = 1000;

function isoDayOf(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lv = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (lv) return `${lv[3]}-${lv[2]!.padStart(2, "0")}-${lv[1]!.padStart(2, "0")}`;
  return "";
}

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function km(raw: string | undefined): number | null {
  const d = (raw ?? "").replace(/[^\d]/g, "");
  return d ? Number(d) : null;
}

/** Agrākā importa diena šajā reģistrā (Toldsyn import, «Importēts»). */
export function registryImportStartIso(b: VinRegistryBlockState | undefined, home: string): string {
  const days = (b?.timeline ?? [])
    .filter((r) => {
      const c = (r.country ?? "").trim();
      return (!c || c === home) && IMPORT_EVENT_RE.test(r.event ?? "") && !EXPORT_EVENT_RE.test(r.event ?? "");
    })
    .map((r) => isoDayOf(r.date))
    .filter(Boolean)
    .sort();
  return days[0] ?? "";
}

/** «Pēdējais zināmais reģistrācijas numurs: DK XX11111 (Dānija)» → «Dānija». */
export function registryLatestForeignCountry(b: VinRegistryBlockState | undefined): string {
  const m = FOREIGN_PLATE_RE.exec(`${b?.statusRecords ?? ""}\n${b?.autoNotes ?? ""}`);
  return m?.[1]?.trim() ?? "";
}

function ownExportIso(b: VinRegistryBlockState | undefined, home: string): string {
  const days = (b?.timeline ?? [])
    .filter((r) => {
      const c = (r.country ?? "").trim();
      return (!c || c === home) && EXPORT_EVENT_RE.test(r.event ?? "");
    })
    .map((r) => isoDayOf(r.date))
    .filter(Boolean)
    .sort();
  return days[0] ?? "";
}

function homeBlockFor(blocks: WorkspaceSourceBlocks, country: string): VinRegistryBlockState | undefined {
  const key = KEYS.find((k) => REGISTRY_HOME_COUNTRY[k] === country);
  return key ? (blocks[key] as VinRegistryBlockState | undefined) : undefined;
}

/** No kuras dienas bloka rindas ir citas valsts dati (eksports / ārvalsts reģistra imports). */
export function registryForeignShift(
  blocks: WorkspaceSourceBlocks,
  key: ReconcileRegistryKey,
): { country: string; fromIso: string } | null {
  const home = REGISTRY_HOME_COUNTRY[key];
  const b = blocks[key] as VinRegistryBlockState | undefined;
  const foreign = registryLatestForeignCountry(b);
  if (!foreign || foreign === home) return null;
  const foreignBlock = homeBlockFor(blocks, foreign);
  const fromIso = registryImportStartIso(foreignBlock, foreign) || ownExportIso(b, home);
  return fromIso ? { country: foreign, fromIso } : null;
}

function fixFirstRegistrationCountry(b: VinRegistryBlockState, home: string): VinRegistryBlockState {
  const importIso = registryImportStartIso(b, home);
  if (!importIso) return b;
  const before = (date: string) => {
    const iso = isoDayOf(date);
    return Boolean(iso) && iso < importIso;
  };
  let changed = false;
  const mileage = (b.mileage ?? []).map((r) => {
    if (r.country === home && before(r.date) && FIRST_REGISTRATION_RE.test(r.origin ?? "")) {
      changed = true;
      return { ...r, country: "" };
    }
    return r;
  });
  const timeline = (b.timeline ?? []).map((r) => {
    if (r.country === home && before(r.date) && FIRST_REGISTRATION_RE.test(r.event ?? "")) {
      changed = true;
      return { ...r, country: "" };
    }
    return r;
  });
  return changed ? { ...b, mileage, timeline } : b;
}

function shiftForeignRows(b: VinRegistryBlockState, shift: { country: string; fromIso: string }): VinRegistryBlockState {
  let changed = false;
  const move = <T extends { date: string; country: string }>(r: T): T => {
    const iso = isoDayOf(r.date);
    if (!iso || iso < shift.fromIso || r.country === shift.country) return r;
    changed = true;
    return { ...r, country: shift.country };
  };
  const mileage = (b.mileage ?? []).map(move);
  const timeline = (b.timeline ?? []).map(move);
  return changed ? { ...b, mileage, timeline } : b;
}

const DK_OWNERS_AUTO_RE = /^Īpašnieku skaits Dānijā:\s*\d+\.?$/u;
const LEASING_LINE_RE = /^Līzings:.*$/mu;

function refreshTjekbilDerived(b: VinRegistryBlockState): VinRegistryBlockState {
  const derived = tjekbilDerivedFromRaw(b.rawUnprocessedData ?? "");
  if (!derived) return b;
  let out = b;
  const owners = (b.ownersSummary ?? "").trim();
  if (derived.ownersSummary && DK_OWNERS_AUTO_RE.test(owners) && owners !== derived.ownersSummary) {
    out = { ...out, ownersSummary: derived.ownersSummary };
  }
  const status = b.statusRecords ?? "";
  if (derived.leasingLine && LEASING_LINE_RE.test(status)) {
    const next = status.replace(LEASING_LINE_RE, derived.leasingLine);
    if (next !== status) out = { ...out, statusRecords: next };
  }
  return out;
}

/** Nedestruktīva valstu saskaņošana visiem ārvalstu reģistru blokiem (idempotenta). */
export function reconcileRegistryBlockCountries(blocks: WorkspaceSourceBlocks): WorkspaceSourceBlocks {
  let out = blocks;
  const set = (key: ReconcileRegistryKey, next: VinRegistryBlockState) => {
    if (next !== out[key]) out = { ...out, [key]: next };
  };
  for (const key of KEYS) {
    const b = out[key] as VinRegistryBlockState | undefined;
    if (!b) continue;
    let next = fixFirstRegistrationCountry(b, REGISTRY_HOME_COUNTRY[key]);
    if (key === "tjekbil") next = refreshTjekbilDerived(next);
    set(key, next);
  }
  for (const key of KEYS) {
    const shift = registryForeignShift(out, key);
    const b = out[key] as VinRegistryBlockState | undefined;
    if (shift && b) set(key, shiftForeignRows(b, shift));
  }
  return out;
}

export type RegistryDisplayRows = Pick<VinRegistryBlockState, "mileage" | "timeline" | "statusRecords">;

/**
 * Atskaitei: citas valsts rindas, kuras jau rāda tās valsts reģistrs (tā pati diena ±3, km ±1000), izlaiž;
 * «Pēdējā apskate» ar ārvalsts datumu nav šī reģistra fakts. Dānijas laika joslā - līzinga/OCTA apvienošana.
 */
export function registryBlockDisplayView(
  blocks: WorkspaceSourceBlocks,
  key: string,
  b: VinRegistryBlockState,
): RegistryDisplayRows {
  const mileageIn = b.mileage ?? [];
  const timelineIn = b.timeline ?? [];
  const statusIn = b.statusRecords ?? "";
  if (!(key in REGISTRY_HOME_COUNTRY)) return { mileage: mileageIn, timeline: timelineIn, statusRecords: statusIn };
  const home = REGISTRY_HOME_COUNTRY[key as ReconcileRegistryKey];
  const foreignDays = new Set<string>();
  const mileage = mileageIn.filter((r) => {
    const c = (r.country ?? "").trim();
    if (!c || c === home) return true;
    const other = homeBlockFor(blocks, c);
    const iso = isoDayOf(r.date);
    const k = km(r.odometer);
    if (!other || other === b || !iso) return true;
    foreignDays.add(iso);
    const dup = (other.mileage ?? []).some((o) => {
      const oi = isoDayOf(o.date);
      const ok = km(o.odometer);
      return oi && daysApart(oi, iso) <= DUP_DAYS && (k == null || ok == null || Math.abs(ok - k) <= DUP_KM);
    });
    return !dup;
  });
  let timeline = timelineIn.filter((r) => {
    const c = (r.country ?? "").trim();
    if (!c || c === home) return true;
    const other = homeBlockFor(blocks, c);
    const iso = isoDayOf(r.date);
    if (!other || other === b || !iso) return true;
    foreignDays.add(iso);
    return !(other.timeline ?? []).some((o) => {
      const oi = isoDayOf(o.date);
      return oi && daysApart(oi, iso) <= DUP_DAYS;
    });
  });
  if (key === "tjekbil") timeline = collapseDkLeaseInsuranceRows(timeline);
  if (key === "carinfo") {
    timeline = timeline.map((r) => {
      const event = translateStoredCarinfoEvent(r.event ?? "");
      return event === r.event ? r : { ...r, event };
    });
  }
  const statusRecords =
    foreignDays.size === 0
      ? statusIn
      : statusIn
          .split("\n")
          .filter((line) => {
            const m = /^Pēdējā apskate:\s*(\d{1,2}\.\d{1,2}\.\d{4})/u.exec(line.trim());
            return !(m && foreignDays.has(isoDayOf(m[1])));
          })
          .join("\n");
  return { mileage, timeline, statusRecords };
}
