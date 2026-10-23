import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { EcsddAutoStatus, EcsddQueryKind, EcsddRelaySession } from "@/lib/ecsdd-auto-types";
import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/**
 * e.csdd automātikas tīrā loģika (bez tīkla): ko meklēt, releja notikumi -> stāvoklis,
 * vai tekstu drīkst ievietot CSDD blokā automātiski, latviskie teksti.
 */

export type EcsddRelayJobEvent = {
  kind: "job";
  jobId: string;
  ref: string;
  query: string;
  state: "queued" | "awaiting_login" | "awaiting_smartid" | "searching" | "result" | "error";
  verificationCode?: string;
  /** `awaiting_login`: night | yield | blocked | off | busy */
  reason?: string;
  found?: boolean;
  rawText?: string;
  code?: string;
  message?: string;
  at?: string;
};

export type EcsddQueryTarget = { kind: EcsddQueryKind; query: string } | null;

/** Personalizēts numurs: 2-8 burti/cipari, vismaz viens burts (tā pati robeža kā relejā). */
function isPlate(n: string): boolean {
  return /^[A-Z0-9]{2,8}$/.test(n) && /[A-Z]/.test(n);
}

/**
 * Pēc kā meklēt e.csdd: pasūtījuma VIN (precīzāk, numurs var būt pārlikts), citādi CSDD bloka / API numurs.
 * `orderVinOrPlate` var būt arī numurzīme (pasūtījumi pēc numura).
 */
export function resolveEcsddQuery(csdd: CsddFormFields | null | undefined, orderVinOrPlate?: string | null): EcsddQueryTarget {
  const vin = normalizeVin(orderVinOrPlate ?? "");
  if (isValidVin(vin)) return { kind: "vin", query: vin };
  const regVin = normalizeVin(csdd?.registry?.data?.vin ?? csdd?.vin ?? "");
  if (isValidVin(regVin)) return { kind: "vin", query: regVin };
  for (const raw of [csdd?.registry?.data?.registrationNumber, csdd?.registrationNumber, orderVinOrPlate]) {
    const p = normalizePlateNumber(raw ?? "");
    if (isPlate(p)) return { kind: "plate", query: p };
  }
  return null;
}

/**
 * Automātika pēc apmaksas: tikai, ja CSDD API auto atrada (tātad e.csdd ir ko rādīt) un RAW vēl tukšs
 * (Nila ielīmējumu nepārrakstām, ārzemju auto Smart-ID neprasām).
 */
export function ecsddAutoShouldStart(csdd: CsddFormFields | null | undefined): boolean {
  if (!csdd) return false;
  if ((csdd.rawUnprocessedData ?? "").trim()) return false;
  return Boolean(csdd.registry?.data?.vin?.trim() || csdd.registry?.data?.registrationNumber?.trim());
}

const RELAY_ERROR_LV: Record<string, string> = {
  smartid_timeout: "Smart-ID netika apstiprināts 120 s laikā - spied \"Pieprasīt vēlreiz\"",
  smartid_refused: "Smart-ID pieprasījums atteikts telefonā",
  code_not_read: "Neizdevās nolasīt Smart-ID kontrolkodu - jāpārbauda manuāli",
  login_not_kept: "Pēc Smart-ID e.csdd neielogojās - jāpārbauda manuāli",
  captcha: "e.csdd vai Vienotā pieteikšanās prasa captcha - jāpārbauda manuāli",
  page_changed: "e.csdd lapa mainījusies - ielīmē datus ar roku",
  unavailable: "e.csdd vai Vienotā pieteikšanās nav pieejama",
  paid: "e.csdd prasa maksu - relejs neko neapmaksā",
  not_configured: "Relejam nav Smart-ID personas koda (serverī)",
  invalid_query: "Nav derīga VIN vai numura e.csdd meklēšanai",
  queue_full: "e.csdd rinda pilna - mēģini vēlāk",
};

export function ecsddRelayErrorLv(code: string | undefined, fallback?: string): string {
  return (code && RELAY_ERROR_LV[code]) || fallback?.slice(0, 200) || "e.csdd pieprasījums neizdevās";
}

const WAIT_REASON_LV: Record<string, string> = {
  night: "Gaida rītu (08:00) - naktī Smart-ID automātiski neprasām",
  yield: "Gaida - e.csdd tagad lieto tu (savā pārlūkā). Spied \"Pieslēgt e.csdd\", ja vari atdot",
  blocked: "Gaida pieslēgšanos - iepriekšējais Smart-ID netika apstiprināts. Spied \"Pieslēgt e.csdd\"",
  off: "Gaida pieslēgšanos - spied \"Pieslēgt e.csdd\"",
  busy: "Gaida pieslēgšanos e.csdd",
};

export function ecsddWaitReasonLv(reason: string | undefined): string {
  return (reason && WAIT_REASON_LV[reason]) || "Gaida pieslēgšanos e.csdd";
}

/** Starpstāvokļi (ne gala rezultāts). */
export function reduceEcsddProgress(prev: EcsddAutoStatus | null, ev: EcsddRelayJobEvent, now: string): EcsddAutoStatus {
  const base: EcsddAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    query: ev.query || prev?.query,
    jobId: ev.jobId || prev?.jobId,
    updatedAt: now,
  };
  delete base.verificationCode;
  if (ev.state === "awaiting_smartid") {
    const code = /^\d{4}$/.test(ev.verificationCode ?? "") ? ev.verificationCode : undefined;
    return { ...base, state: "awaiting_smartid", ...(code ? { verificationCode: code } : {}), message: "Apstiprini Smart-ID telefonā" };
  }
  if (ev.state === "awaiting_login") return { ...base, state: "awaiting_login", message: ecsddWaitReasonLv(ev.reason) };
  if (ev.state === "searching") return { ...base, state: "searching", message: "Meklē e.csdd" };
  if (ev.state === "error") return { ...base, state: "error", message: ecsddRelayErrorLv(ev.code, ev.message) };
  return { ...base, state: "queued", message: "Gaida rindā" };
}

/** Gala rezultāts no releja. */
export function reduceEcsddResult(prev: EcsddAutoStatus | null, ev: EcsddRelayJobEvent, now: string): EcsddAutoStatus {
  const base: EcsddAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    query: ev.query || prev?.query,
    jobId: ev.jobId || prev?.jobId,
    updatedAt: now,
    checkedAt: ev.at || now,
  };
  delete base.verificationCode;
  delete base.appliedAt;
  delete base.rawText;
  const raw = (ev.rawText ?? "").trim();
  if (ev.found && raw) return { ...base, state: "found", rawText: raw.slice(0, 60_000), message: "e.csdd dati saņemti" };
  if (ev.found) return { ...base, state: "error", message: "e.csdd atdeva tukšu lapu - ielīmē datus ar roku" };
  return { ...base, state: "not_found", message: "e.csdd šo auto neatrada" };
}

/** Automātiski ievieto tikai tukšā RAW laukā un tikai vienreiz. */
export function ecsddAutoCanApply(status: EcsddAutoStatus | null | undefined, csdd: CsddFormFields): boolean {
  if (!status || status.state !== "found" || !status.rawText?.trim() || status.appliedAt) return false;
  return !(csdd.rawUnprocessedData ?? "").trim();
}

/** Sesijas rinda adminam: kas notiek ar e.csdd sesiju un vai tā ietekmē Nila pārlūku. */
export function ecsddSessionSummaryLv(s: EcsddRelaySession | null | undefined, fmtTime: (iso: string) => string): string {
  if (!s) return "e.csdd relejs nav sasniedzams";
  switch (s.state) {
    case "active":
      return s.keepAlive
        ? "Serveris ielogojies e.csdd (sesija tiek uzturēta). Ja ielogosies savā pārlūkā, serveris atkāpsies"
        : "Serveris ielogojies e.csdd (ārpus darba laika sesiju neuztur)";
    case "logging_in":
      return "Serveris piesakās e.csdd";
    case "awaiting_smartid":
      return "Gaida Smart-ID apstiprinājumu telefonā";
    case "kicked":
      return `e.csdd sesiju pārņēma cits pārlūks (tu?)${s.kickedAt ? ` ${fmtTime(s.kickedAt)}` : ""}${
        s.yieldUntil ? ` - automātika pati nepieteiksies līdz ${fmtTime(s.yieldUntil)}` : ""
      }`;
    case "expired":
      return "e.csdd sesija beigusies - nākamā uzziņa prasīs Smart-ID";
    default:
      return s.yieldUntil ? `e.csdd atbrīvots - automātika nepieteiksies līdz ${fmtTime(s.yieldUntil)}` : "Serveris nav ielogojies e.csdd";
  }
}
