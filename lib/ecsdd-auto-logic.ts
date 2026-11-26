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
 * Automātika pēc pasūtījuma apstrādes: tikai, ja CSDD API auto atrada vai ir LV numurs (tātad e.csdd ir ko rādīt;
 * ārzemju auto Smart-ID neprasām). RAW saturs vairs nav šķērslis - e.csdd teksts to aizvieto, bet iepriekšējais
 * RAW tiek saglabāts (`previousRawText`) un ir atjaunojams.
 */
export function ecsddAutoShouldStart(csdd: CsddFormFields | null | undefined): boolean {
  if (!csdd) return false;
  return Boolean(
    csdd.registry?.data?.vin?.trim() || csdd.registry?.data?.registrationNumber?.trim() || csdd.registrationNumber?.trim(),
  );
}

/** Iepriekšējais automātikas stāvoklis, kas neliedz automātikai mēģināt vēlreiz (nekas netika prasīts). */
export function ecsddAutoPrevAllowsStart(prev: EcsddAutoStatus | null | undefined): boolean {
  return !prev || prev.state === "skipped" || prev.state === "not_configured";
}

/** Smart-ID taimauts adminā (Nila 26.11 lēmums): pēc 5 min «Smart-ID neapstiprināts» + «Mēģināt vēlreiz». */
export const ECSDD_SMARTID_TIMEOUT_MS = 5 * 60_000;

export const ECSDD_SMARTID_NOT_APPROVED_LV = "Smart-ID neapstiprināts - spied \"Mēģināt vēlreiz\"";

/** Kļūdas, pēc kurām pasūtījumu ieliek rindā no jauna, kad serveris atkal ielogojas. */
export const ECSDD_SMARTID_RETRY_CODES: readonly string[] = ["smartid_timeout", "smartid_refused"];

/** Vai pasūtījums gaida Smart-ID ilgāk par 5 min (relejs nav paziņojis taimautu). */
export function ecsddSmartIdExpired(s: EcsddAutoStatus | null | undefined, nowMs: number): boolean {
  if (!s || (s.state !== "awaiting_smartid" && !(s.state === "awaiting_login" && s.waitReason === "busy"))) return false;
  const asked = Date.parse(s.smartIdAskedAt ?? "");
  return Number.isFinite(asked) && nowMs - asked > ECSDD_SMARTID_TIMEOUT_MS;
}

/** Stāvoklis pēc 5 min bez Smart-ID apstiprinājuma. */
export function ecsddSmartIdExpiredStatus(s: EcsddAutoStatus, now: string): EcsddAutoStatus {
  const next: EcsddAutoStatus = { ...s, state: "error", errorCode: "smartid_timeout", message: ECSDD_SMARTID_NOT_APPROVED_LV, updatedAt: now };
  delete next.verificationCode;
  delete next.waitReason;
  return next;
}

/** Vai adminā rādīt «Mēģināt vēlreiz» (Smart-ID nav apstiprināts vai automātika vairs pati neprasa). */
export function ecsddNeedsSmartIdRetry(s: EcsddAutoStatus | null | undefined): boolean {
  if (!s) return false;
  if (s.state === "error" && ECSDD_SMARTID_RETRY_CODES.includes(s.errorCode ?? "")) return true;
  return s.state === "awaiting_login" && s.waitReason === "blocked";
}

const RELAY_ERROR_LV: Record<string, string> = {
  smartid_timeout: ECSDD_SMARTID_NOT_APPROVED_LV,
  smartid_refused: "Smart-ID atteikts telefonā - spied \"Mēģināt vēlreiz\"",
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
  blocked: "Smart-ID neapstiprināts (automātika vairs pati neprasa) - spied \"Mēģināt vēlreiz\"",
  off: "Gaida pieslēgšanos - spied \"Pieslēgt e.csdd\"",
  busy: "Gaida Smart-ID (viens pieprasījums visiem gaidošajiem pasūtījumiem)",
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
  delete base.waitReason;
  delete base.errorCode;
  if (ev.state === "awaiting_smartid") {
    const code = /^\d{4}$/.test(ev.verificationCode ?? "") ? ev.verificationCode : undefined;
    return {
      ...base,
      state: "awaiting_smartid",
      ...(code ? { verificationCode: code } : {}),
      smartIdAskedAt: prev?.smartIdAskedAt || now,
      message: "Gaida Smart-ID - apstiprini telefonā",
    };
  }
  if (ev.state === "awaiting_login") {
    const reason = ev.reason?.slice(0, 20);
    return {
      ...base,
      state: "awaiting_login",
      ...(reason ? { waitReason: reason } : {}),
      // Cita pasūtījuma Smart-ID jau gaida - tas pats pieprasījums apkalpos arī šo.
      ...(reason === "busy" ? { smartIdAskedAt: prev?.smartIdAskedAt || now } : {}),
      message: ecsddWaitReasonLv(reason),
    };
  }
  if (ev.state === "searching") return { ...base, state: "searching", message: "Meklē e.csdd" };
  if (ev.state === "error") {
    return { ...base, state: "error", ...(ev.code ? { errorCode: ev.code.slice(0, 40) } : {}), message: ecsddRelayErrorLv(ev.code, ev.message) };
  }
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
  delete base.appliedBy;
  delete base.restoredAt;
  delete base.rawText;
  delete base.waitReason;
  delete base.errorCode;
  const raw = (ev.rawText ?? "").trim();
  if (ev.found && raw) return { ...base, state: "found", rawText: raw.slice(0, 60_000), message: "e.csdd dati saņemti" };
  if (ev.found) return { ...base, state: "error", message: "e.csdd atdeva tukšu lapu - ielīmē datus ar roku" };
  return { ...base, state: "not_found", message: "e.csdd šo auto neatrada" };
}

/** Vai e.csdd tekstu (vēl) var ievietot CSDD blokā ar pogu «Ievietot e.csdd datus». */
export function ecsddCanApplyManually(status: EcsddAutoStatus | null | undefined, csdd: CsddFormFields): boolean {
  if (!status || status.state !== "found" || !status.rawText?.trim()) return false;
  return (csdd.rawUnprocessedData ?? "").trim() !== status.rawText.trim();
}

/**
 * Serveris ievietoja e.csdd tekstu (releja atzvanā), bet atvērtajā cilnē vēl ir vecais RAW - cilne to ievieto
 * pati ar to pašu parseri (rezultāts sakrīt ar servera). Ja Nils RAW pēc tam mainījis vai atjaunojis - neaiztiek.
 */
export function ecsddClientShouldSync(status: EcsddAutoStatus | null | undefined, csdd: CsddFormFields): boolean {
  if (!status || status.state !== "found" || status.appliedBy !== "auto" || !status.appliedAt || status.restoredAt) return false;
  const raw = status.rawText?.trim() ?? "";
  const local = (csdd.rawUnprocessedData ?? "").trim();
  if (!raw || local === raw) return false;
  return local === (status.previousRawText ?? "").trim();
}

/** Vai rādīt «Atjaunot iepriekšējo RAW». */
export function ecsddCanRestorePrevious(status: EcsddAutoStatus | null | undefined, csdd: CsddFormFields): boolean {
  if (!status || !status.appliedAt || !status.previousRawText?.trim()) return false;
  return (csdd.rawUnprocessedData ?? "").trim() !== status.previousRawText.trim();
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
