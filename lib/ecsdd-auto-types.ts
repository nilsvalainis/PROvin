/**
 * e.csdd automātiskās uzziņas stāvoklis vienam pasūtījumam (atsevišķs fails, nevis CSDD bloks,
 * lai releja atbildes neplūstu caur klienta autosave sapludināšanu). Teksts blokā nonāk tikai caur
 * to pašu RAW parseri, ko lieto Nila ielīmējums.
 */

export type EcsddAutoState =
  | "skipped"
  | "not_configured"
  | "queued"
  | "awaiting_login"
  | "awaiting_smartid"
  | "searching"
  | "found"
  | "not_found"
  | "error";

export type EcsddQueryKind = "vin" | "plate";

export type EcsddAutoStatus = {
  state: EcsddAutoState;
  /** VIN vai LV numurs, pēc kura meklēja. */
  query?: string;
  queryKind?: EcsddQueryKind;
  jobId?: string;
  /** Smart-ID kontrolkods (4 cipari) - tikai kamēr `awaiting_smartid`. */
  verificationCode?: string;
  /** Latvisks paskaidrojums adminam (bez personas datiem). */
  message?: string;
  requestedAt?: string;
  updatedAt: string;
  checkedAt?: string;
  /** e.csdd `tadati` teksts (personas dati jau izņemti relejā). */
  rawText?: string;
  /** Kad teksts ievietots CSDD blokā (automātiski vai ar pogu). */
  appliedAt?: string;
  trigger?: "auto" | "manual";
};

/** Releja sesijas skats (relay/provin-ecsdd/lib/session.mjs `publicSession`). */
export type EcsddRelaySessionState = "logged_out" | "logging_in" | "awaiting_smartid" | "active" | "kicked" | "expired";

export type EcsddRelaySession = {
  state: EcsddRelaySessionState;
  verificationCode?: string;
  activeSince?: string;
  lastOkAt?: string;
  lastLookupAt?: string;
  yieldUntil?: string;
  kickedAt?: string;
  lastError?: string;
  autoLoginBlockedReason?: string | null;
  keepAlive?: boolean;
  updatedAt?: string;
};

export const ECSDD_AUTO_ACTIVE_STATES: readonly EcsddAutoState[] = ["queued", "awaiting_login", "awaiting_smartid", "searching"];

export function isEcsddAutoActive(s: EcsddAutoStatus | null | undefined): boolean {
  return Boolean(s && ECSDD_AUTO_ACTIVE_STATES.includes(s.state));
}
