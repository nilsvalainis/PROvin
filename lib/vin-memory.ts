/**
 * VIN atmiņa: ko mēs paši esam redzējuši par konkrētu VIN (datums + km + avots + modelis), bez bildēm
 * un bez personas datiem. Pilda izsoļu ielase (Autobid, eCarsTrade, Openline; Auto1 VIN slēpj) un
 * pasūtījumi ar CSDD modeli. Nākotnē: auditiem "mūsu arhīvā 2024-03 184 000 km (Autobid)".
 *
 * Tīrās funkcijas (apvienošana, dedupe) šeit; krātuve `lib/vin-memory-store.ts`.
 * Viens VIN - viens ieraksts ar novērojumu sarakstu; vienā dienā no viena avota tikai viens novērojums.
 */

export const VIN_MEMORY_SOURCES = ["auto1", "autobid", "openline", "ecarstrade", "order", "quick_eval", "logistics"] as const;
export type VinMemorySource = (typeof VIN_MEMORY_SOURCES)[number];

export type VinObservation = {
  /** `YYYY-MM-DD` (Europe/Riga nav svarīgs - diena, kad redzēts). */
  date: string;
  source: VinMemorySource;
  /** Nobraukums km; `null`, ja avots nedod. */
  km: number | null;
  /** Marka un modelis, kā avots to raksta (īss). */
  model?: string;
  /** `YYYY-MM` vai `YYYY-MM-DD` pirmā reģistrācija, ja zināma. */
  firstRegistration?: string;
  country?: string;
};

export type VinMemoryEntry = {
  vin: string;
  observations: VinObservation[];
  updatedAt: string;
};

export type VinMemoryTable = Record<string, VinMemoryEntry>;

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Īsts VIN mūsu atmiņai: 17 zīmes bez I/O/Q; tīri heksa virknes (Auto1 jaucējkodi) izslēgtas. */
export function isMemoryVin(raw: string): boolean {
  const v = raw.replace(/\s+/g, "").toUpperCase();
  if (!VIN_RE.test(v)) return false;
  if (/^[0-9A-F]{17}$/.test(v)) return false;
  return true;
}

export function normalizeVin(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function cleanKm(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n < 5_000_000 ? Math.round(n) : null;
}

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function cleanShort(v: unknown, max = 80): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
}

export type VinObservationInput = {
  vin: string;
  date: unknown;
  source: VinMemorySource;
  km?: unknown;
  model?: unknown;
  firstRegistration?: unknown;
  country?: unknown;
};

/** Sakārto ievadi; `null`, ja VIN vai datums nederīgs. */
export function toObservation(input: VinObservationInput): { vin: string; obs: VinObservation } | null {
  if (!isMemoryVin(input.vin)) return null;
  const date = cleanDate(input.date);
  if (!date) return null;
  const obs: VinObservation = { date, source: input.source, km: cleanKm(input.km) };
  const model = cleanShort(input.model);
  if (model) obs.model = model;
  const fr = cleanShort(input.firstRegistration, 10);
  if (fr && /^\d{4}(-\d{2}){1,2}$/.test(fr)) obs.firstRegistration = fr;
  const country = cleanShort(input.country, 2);
  if (country && /^[A-Z]{2}$/i.test(country)) obs.country = country.toUpperCase();
  return { vin: normalizeVin(input.vin), obs };
}

function sameObservation(a: VinObservation, b: VinObservation): boolean {
  return a.date === b.date && a.source === b.source;
}

/**
 * Tīra funkcija: pievieno novērojumus tabulai. Vienā dienā no viena avota paliek viens ieraksts
 * (jaunākais km, ja tas ir lielāks par 0). Atgriež jauno tabulu un pievienoto skaitu.
 */
export function mergeObservations(
  table: VinMemoryTable,
  inputs: VinObservationInput[],
  now: Date = new Date(),
): { table: VinMemoryTable; added: number; updated: number } {
  const out: VinMemoryTable = { ...table };
  let added = 0;
  let updated = 0;
  const stamp = now.toISOString();
  for (const input of inputs) {
    const parsed = toObservation(input);
    if (!parsed) continue;
    const prev = out[parsed.vin];
    const list = prev ? [...prev.observations] : [];
    const idx = list.findIndex((o) => sameObservation(o, parsed.obs));
    if (idx >= 0) {
      const old = list[idx];
      const next: VinObservation = { ...old, ...parsed.obs, km: parsed.obs.km ?? old.km };
      if (JSON.stringify(next) === JSON.stringify(old)) continue;
      list[idx] = next;
      updated += 1;
    } else {
      list.push(parsed.obs);
      added += 1;
    }
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.source.localeCompare(b.source)));
    out[parsed.vin] = { vin: parsed.vin, observations: list, updatedAt: stamp };
  }
  return { table: out, added, updated };
}

/** Pēdējais zināmais nobraukums (ar datumu un avotu) vai `null`. */
export function latestKm(entry: VinMemoryEntry | undefined): VinObservation | null {
  if (!entry) return null;
  const withKm = entry.observations.filter((o) => o.km);
  return withKm.length ? withKm[withKm.length - 1] : null;
}

/** Nobraukuma pretruna: vēlāks novērojums ar mazāku km nekā agrāks (rullēts odometrs vai kļūda). */
export function kmRollback(entry: VinMemoryEntry | undefined): { earlier: VinObservation; later: VinObservation } | null {
  if (!entry) return null;
  const withKm = entry.observations.filter((o): o is VinObservation & { km: number } => typeof o.km === "number");
  for (let i = 1; i < withKm.length; i += 1) {
    if (withKm[i].km < withKm[i - 1].km) return { earlier: withKm[i - 1], later: withKm[i] };
  }
  return null;
}

export function parseVinMemoryTable(raw: unknown): VinMemoryTable {
  const out: VinMemoryTable = {};
  const entries = (raw as { entries?: unknown })?.entries;
  if (!entries || typeof entries !== "object") return out;
  for (const [vin, e] of Object.entries(entries as Record<string, unknown>)) {
    if (!isMemoryVin(vin) || !e || typeof e !== "object") continue;
    const obsRaw = (e as { observations?: unknown }).observations;
    const observations: VinObservation[] = [];
    for (const o of Array.isArray(obsRaw) ? obsRaw : []) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      const source = VIN_MEMORY_SOURCES.find((s) => s === r.source);
      const date = cleanDate(r.date);
      if (!source || !date) continue;
      const obs: VinObservation = { date, source, km: cleanKm(r.km) };
      const model = cleanShort(r.model);
      if (model) obs.model = model;
      const fr = cleanShort(r.firstRegistration, 10);
      if (fr) obs.firstRegistration = fr;
      const c = cleanShort(r.country, 2);
      if (c) obs.country = c.toUpperCase();
      observations.push(obs);
    }
    if (!observations.length) continue;
    const updatedAt = typeof (e as { updatedAt?: unknown }).updatedAt === "string" ? (e as { updatedAt: string }).updatedAt : new Date(0).toISOString();
    out[normalizeVin(vin)] = { vin: normalizeVin(vin), observations, updatedAt };
  }
  return out;
}

export function serializeVinMemoryTable(table: VinMemoryTable): string {
  return JSON.stringify({ version: 1, entries: table });
}
