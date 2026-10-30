/**
 * Bezmaksas VIN pārbaudes un CSDD zvanu uzskaite (mārketingam un CSDD līguma kontrolei).
 * Glabājam tikai skaitītājus pa dienām - bez VIN, numurzīmēm, IP vai citiem personas datiem.
 *
 * Tīrās funkcijas šeit; krātuve `lib/vin-check-stats-store.ts`; admin bloks `AdminVinChecksCard`.
 */

export const VIN_CHECK_KINDS = ["vin", "plate"] as const;
export type VinCheckKind = (typeof VIN_CHECK_KINDS)[number];

export const VIN_CHECK_OUTCOMES = [
  "ok",
  "invalid_length",
  "invalid_chars",
  "invalid_plate",
  "not_found",
  "csdd_error",
  "rate_limited",
  "quota",
] as const;
export type VinCheckOutcome = (typeof VIN_CHECK_OUTCOMES)[number];

export const VIN_CHECK_SOURCES = ["home", "decoder", "direct", "test"] as const;
export type VinCheckSource = (typeof VIN_CHECK_SOURCES)[number];

/** Modeļa atpazīšana: kura shēma deva modeli; `none` = tikai ražotājs/valsts. */
export const VIN_CHECK_MODEL = ["vag", "mercedes", "volvo", "bmw", "learned", "vpic", "csdd", "none"] as const;
export type VinCheckModel = (typeof VIN_CHECK_MODEL)[number];

export const VIN_CHECK_CTAS = ["cta_audit", "cta_free"] as const;
export type VinCheckCta = (typeof VIN_CHECK_CTAS)[number];

export const CSDD_CALL_OUTCOMES = ["found", "not_found", "error"] as const;
export type CsddCallOutcome = (typeof CSDD_CALL_OUTCOMES)[number];
export const CSDD_CALL_CALLERS = ["decoder", "checkout", "admin"] as const;
export type CsddCallCaller = (typeof CSDD_CALL_CALLERS)[number];

export type VinCheckEvent =
  | {
      type: "check";
      kind: VinCheckKind;
      outcome: VinCheckOutcome;
      source: VinCheckSource;
      region?: string;
      model?: VinCheckModel;
      /** Vai mūsu VIN atmiņā ir ieraksti par šo VIN. */
      memoryHit?: boolean;
    }
  | { type: "cta"; cta: VinCheckCta; source: VinCheckSource }
  | { type: "csdd"; outcome: CsddCallOutcome; caller: CsddCallCaller };

/** Vienas dienas skaitītāji: atslēga -> skaits (piem. "check:plate:ok", "region:europe"). */
export type VinCheckDay = { date: string; counts: Record<string, number> };

export function eventKeys(e: VinCheckEvent): string[] {
  if (e.type === "cta") return [`cta:${e.cta}`, `cta_src:${e.source}:${e.cta}`];
  if (e.type === "csdd") return [`csdd:${e.caller}:${e.outcome}`];
  const keys = [`check:${e.kind}:${e.outcome}`, `src:${e.source}`];
  if (e.outcome === "ok") {
    if (e.region) keys.push(`region:${e.region}`);
    if (e.model) keys.push(`model:${e.model}`);
    if (e.memoryHit) keys.push("memory:hit");
  }
  return keys;
}

export function applyEvent(day: VinCheckDay, e: VinCheckEvent): VinCheckDay {
  const counts = { ...day.counts };
  for (const k of eventKeys(e)) counts[k] = (counts[k] ?? 0) + 1;
  return { date: day.date, counts };
}

export function parseVinCheckDay(raw: unknown, date: string): VinCheckDay {
  const counts: Record<string, number> = {};
  const src = (raw as { counts?: unknown })?.counts;
  if (src && typeof src === "object") {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (/^[a-z_]+(:[a-z0-9_]+){1,2}$/.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0) counts[k] = Math.floor(v);
    }
  }
  return { date, counts };
}

export type VinCheckSummary = {
  days: number;
  checks: number;
  /** Pieprasījumi pa veidu un iznākumu. */
  byKind: Record<VinCheckKind, Record<VinCheckOutcome, number>>;
  byRegion: Record<string, number>;
  byModel: Record<string, number>;
  bySource: Record<string, number>;
  memoryHits: number;
  cta: Record<VinCheckCta, number>;
  csdd: Record<CsddCallCaller, Record<CsddCallOutcome, number>>;
  csddTotal: number;
};

function zeroOutcomes(): Record<VinCheckOutcome, number> {
  return Object.fromEntries(VIN_CHECK_OUTCOMES.map((o) => [o, 0])) as Record<VinCheckOutcome, number>;
}

function zeroCsdd(): Record<CsddCallOutcome, number> {
  return Object.fromEntries(CSDD_CALL_OUTCOMES.map((o) => [o, 0])) as Record<CsddCallOutcome, number>;
}

export function summarizeVinCheckDays(days: VinCheckDay[]): VinCheckSummary {
  const s: VinCheckSummary = {
    days: days.length,
    checks: 0,
    byKind: { vin: zeroOutcomes(), plate: zeroOutcomes() },
    byRegion: {},
    byModel: {},
    bySource: {},
    memoryHits: 0,
    cta: { cta_audit: 0, cta_free: 0 },
    csdd: { decoder: zeroCsdd(), checkout: zeroCsdd(), admin: zeroCsdd() },
    csddTotal: 0,
  };
  for (const d of days) {
    for (const [k, n] of Object.entries(d.counts)) {
      const [a, b, c] = k.split(":");
      if (a === "check" && (b === "vin" || b === "plate") && (VIN_CHECK_OUTCOMES as readonly string[]).includes(c)) {
        s.byKind[b][c as VinCheckOutcome] += n;
        s.checks += n;
      } else if (a === "region" && b) s.byRegion[b] = (s.byRegion[b] ?? 0) + n;
      else if (a === "model" && b) s.byModel[b] = (s.byModel[b] ?? 0) + n;
      else if (a === "src" && b) s.bySource[b] = (s.bySource[b] ?? 0) + n;
      else if (a === "memory" && b === "hit") s.memoryHits += n;
      else if (a === "cta" && (b === "cta_audit" || b === "cta_free")) s.cta[b] += n;
      else if (a === "csdd" && (CSDD_CALL_CALLERS as readonly string[]).includes(b) && (CSDD_CALL_OUTCOMES as readonly string[]).includes(c)) {
        s.csdd[b as CsddCallCaller][c as CsddCallOutcome] += n;
        s.csddTotal += n;
      }
    }
  }
  return s;
}

/** `YYYY-MM-DD` Europe/Riga diena (uzskaitei un dienas limitam). */
export function rigaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Pēdējās `n` dienas (ieskaitot šodienu), jaunākā pēdējā. */
export function lastRigaDates(n: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(rigaDate(new Date(now.getTime() - i * 86_400_000)));
  return [...new Set(out)];
}

/** Šī mēneša dienas līdz šodienai (CSDD līgums skaita mēnesī). */
export function rigaMonthDates(now: Date = new Date()): string[] {
  const today = rigaDate(now);
  const day = Number(today.slice(8, 10));
  return lastRigaDates(day, now).filter((d) => d.slice(0, 7) === today.slice(0, 7));
}
