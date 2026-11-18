/**
 * CSDD tirdzniecības reģistra datu svaigums Autoparkam (makets 17.11: zaļš / dzeltens / sarkans).
 * Avots: pēdējā veiksmīgā importa atzīme `autoparks-registry-import.json` (Hetzner vai Dropbox).
 * Vecums skaitīts kalendāra dienās Rīgas laikā no brīža, kad reģistrs nolasīts (`registryDate`).
 */

export type RegistryImportStamp = {
  /** Reģistra nolasīšanas datums (`generatedAt`, YYYY-MM-DD...). */
  registryDate: string;
  /** Kad imports ierakstīja kartītes (ISO). */
  importedAt: string;
};

export type RegistryFreshnessTone = "ok" | "warn" | "bad" | "none";

export type RegistryFreshness = {
  tone: RegistryFreshnessTone;
  /** Pilnas dienas kopš nolasījuma; null, ja datu nav. */
  ageDays: number | null;
  /** "šodien 03:41", "vakar", "pirms 3 d. (14.11.)", "nav datu". */
  label: string;
  /** "28.10. 03:41" vai "28.10." - joslai. */
  lastLabel: string;
};

/** Līdz šim dienu skaitam - zaļš; līdz `WARN_MAX_DAYS` - dzeltens; vairāk - sarkans ar joslu. */
export const REGISTRY_FRESH_OK_MAX_DAYS = 1;
export const REGISTRY_FRESH_WARN_MAX_DAYS = 7;

const TZ = "Europe/Riga";

type RigaParts = { date: string; dm: string; hm: string };

function rigaParts(d: Date): RigaParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return { date: `${p("year")}-${p("month")}-${p("day")}`, dm: `${p("day")}.${p("month")}.`, hm: `${p("hour")}:${p("minute")}` };
}

function dayNumber(isoDate: string): number {
  return Math.floor(Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / 86_400_000);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "20 dienas", "21 dienu" (cik ilgi - akuzatīvs). */
export function lvDaysAccusative(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? `${n} dienu` : `${n} dienas`;
}

export function registryFreshness(stamp: RegistryImportStamp | null | undefined, now: Date = new Date()): RegistryFreshness {
  const none: RegistryFreshness = { tone: "none", ageDays: null, label: "nav datu", lastLabel: "" };
  if (!stamp) return none;
  const imported = stamp.importedAt ? new Date(stamp.importedAt) : null;
  const importedOk = imported && Number.isFinite(imported.getTime()) ? rigaParts(imported) : null;
  const regDate = stamp.registryDate.slice(0, 10);

  let date: string;
  let dm: string;
  let hm = "";
  if (ISO_DATE.test(regDate)) {
    date = regDate;
    dm = `${regDate.slice(8, 10)}.${regDate.slice(5, 7)}.`;
    // Laiku rāda tikai, ja imports bija tajā pašā dienā (citādi tas ir importa, ne nolasījuma laiks).
    if (importedOk?.date === regDate) hm = importedOk.hm;
  } else if (importedOk) {
    ({ date, dm, hm } = importedOk);
  } else {
    return none;
  }

  const ageDays = Math.max(0, dayNumber(rigaParts(now).date) - dayNumber(date));
  const at = hm ? ` ${hm}` : "";
  const label = ageDays === 0 ? `šodien${at}` : ageDays === 1 ? `vakar${at}` : `pirms ${ageDays} d. (${dm})`;
  const tone: RegistryFreshnessTone =
    ageDays <= REGISTRY_FRESH_OK_MAX_DAYS ? "ok" : ageDays <= REGISTRY_FRESH_WARN_MAX_DAYS ? "warn" : "bad";
  return { tone, ageDays, label, lastLabel: `${dm}${at}` };
}

/** Importa atzīmes droša nolasīšana (tikai divi lauki; skaiti, faila nosaukums un VIN netiek nodoti klientam). */
export function registryImportStampFromMeta(raw: unknown): RegistryImportStamp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const registryDate = typeof o.registryDate === "string" ? o.registryDate.slice(0, 32) : "";
  const importedAt = typeof o.importedAt === "string" ? o.importedAt.slice(0, 40) : "";
  if (!registryDate && !importedAt) return null;
  return { registryDate, importedAt };
}
