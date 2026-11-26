/**
 * j26: valstu posmi TIKAI no reģistru laika līnijas notikumiem (reģistrācija / eksports),
 * nevis no avota cilnes. Avota nosaukums ("ZVIEDRIJAS REĢISTRI") nav valsts posma pierādījums:
 * pēc eksporta car.info rindas joprojām nāk no Zviedrijas cilnes.
 */
import {
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  type VinRegistryTimelineRow,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { parseMileageDateForSort } from "@/lib/unified-mileage";

export type RegistryCountryPeriod = {
  country: string;
  /** UTC ms */
  from: number;
  /** UTC ms vai null (turpinās) */
  to: number | null;
  fromLabel: string;
  toLabel: string;
  basis: string;
};

const REGISTRY_COUNTRY: Array<{ key: "carinfo" | "traficom_fi" | "tjekbil" | "mnt_ee" | "finnik"; country: string }> = [
  { key: "carinfo", country: "Zviedrija" },
  { key: "traficom_fi", country: "Somija" },
  { key: "tjekbil", country: "Dānija" },
  { key: "mnt_ee", country: "Igaunija" },
  { key: "finnik", country: "Nīderlande" },
];

const REGISTRATION_EVENT_RE = /pirm\p{L}*\s+reģistrācij|first\s+registration|reģistrēt\p{L}*\s+(?:valstī|zviedrij|somij|dānij|igaunij|nīderland)|imports?\b|ievest/iu;
const EXPORT_EVENT_RE = /eksport|export|izvest/iu;

function monthLabel(t: number): string {
  const d = new Date(t);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

const FIRST_REGISTRATION_RE = /pirm\p{L}*\s+reģistrācij|first\s+registration/iu;
const IMPORT_EVENT_RE = /imports?\b|ievest|importēt/iu;

function eventTimes(rows: readonly VinRegistryTimelineRow[], re: RegExp): number[] {
  return rows
    .filter((r) => re.test(r.event ?? ""))
    .map((r) => parseMileageDateForSort(r.date ?? ""))
    .filter((t) => Number.isFinite(t) && t !== Number.NEGATIVE_INFINITY);
}

/**
 * 26.11 (Mercedes SE→DK→LV): DMR „Pirmā reģistrācija” 08.12.2010 ir pirmā reģistrācija jebkurā valstī - auto Dānijā
 * ievests 27.10.2016 (muitas apskate). Rinda ar citu valsti vai pirmā reģistrācija pirms šī reģistra importa
 * nav šīs valsts posma sākums.
 */
function registrationStartTimes(rows: readonly VinRegistryTimelineRow[], country: string): number[] {
  const own = rows.filter((r) => {
    const c = (r.country ?? "").trim();
    return !c || c === country;
  });
  const imports = eventTimes(own, IMPORT_EVENT_RE);
  const firstImport = imports.length > 0 ? Math.min(...imports) : null;
  return own
    .filter((r) => REGISTRATION_EVENT_RE.test(r.event ?? ""))
    .filter((r) => {
      if (firstImport == null || !FIRST_REGISTRATION_RE.test(r.event ?? "")) return true;
      const t = parseMileageDateForSort(r.date ?? "");
      return !(t < firstImport);
    })
    .map((r) => parseMileageDateForSort(r.date ?? ""))
    .filter((t) => Number.isFinite(t) && t !== Number.NEGATIVE_INFINITY);
}

export function collectRegistryCountryPeriods(sourceBlocks: WorkspaceSourceBlocks): RegistryCountryPeriod[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const periods: RegistryCountryPeriod[] = [];
  for (const { key, country } of REGISTRY_COUNTRY) {
    const timeline = blocks[key]?.timeline ?? [];
    const starts = registrationStartTimes(timeline, country);
    if (starts.length === 0) continue;
    const from = Math.min(...starts);
    const ends = eventTimes(timeline, EXPORT_EVENT_RE).filter((t) => t >= from);
    const to = ends.length > 0 ? Math.min(...ends) : null;
    periods.push({
      country,
      from,
      to,
      fromLabel: monthLabel(from),
      toLabel: to != null ? monthLabel(to) : "...",
      basis: `${SOURCE_BLOCK_LABELS[key]} reģistrācija${to != null ? " / eksports" : ""}`,
    });
  }
  periods.sort((a, b) => a.from - b.from);
  // Nākamās valsts reģistrācija noslēdz iepriekšējo posmu, ja eksporta notikuma nav.
  for (let i = 0; i < periods.length - 1; i++) {
    const cur = periods[i]!;
    const next = periods[i + 1]!;
    if (cur.to == null || cur.to > next.from) {
      cur.to = next.from;
      cur.toLabel = next.fromLabel;
    }
  }
  return periods;
}

/** Valsts datumam pēc posmiem; "" = nav zināms vai pārklājas. */
export function countryAtFromPeriods(periods: readonly RegistryCountryPeriod[], t: number): string {
  const hits = periods.filter((p) => t >= p.from && (p.to == null || t < p.to));
  return hits.length === 1 ? hits[0]!.country : "";
}

export function formatRegistryCountryPeriodLine(p: RegistryCountryPeriod): string {
  return `${p.fromLabel} - ${p.toLabel} ${p.country} (${p.basis})`;
}
