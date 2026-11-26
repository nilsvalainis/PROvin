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
  /** `auto` - serveris ievietoja pats (releja atzvanā); `manual` - poga «Ievietot e.csdd datus». */
  appliedBy?: "auto" | "manual";
  /** CSDD RAW teksts pirms e.csdd ievietošanas (atjaunojams ar pogu «Atjaunot iepriekšējo RAW»). */
  previousRawText?: string;
  previousRawSavedAt?: string;
  /** Pēdējā ievietotā e.csdd teksta īsais hash - lai vecāku e.csdd tekstu nesaglabātu kā «iepriekšējo RAW». */
  appliedRawHash?: string;
  /** Kad iepriekšējais RAW atjaunots (pēc tam e.csdd tekstu automātiski vairs neievieto). */
  restoredAt?: string;
  /** Kad šim pasūtījumam pirmo reizi prasīts Smart-ID (5 min taimauts, viens pieprasījums uz pasūtījumu). */
  smartIdAskedAt?: string;
  /** Releja kļūdas kods (`smartid_timeout`, `smartid_refused`, ...). */
  errorCode?: string;
  /** `awaiting_login` iemesls: night | yield | blocked | off | busy */
  waitReason?: string;
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
