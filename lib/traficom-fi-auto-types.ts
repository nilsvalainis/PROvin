/**
 * Traficom (Somija) automātiskās ielases stāvoklis vienam pasūtījumam / VIN SCAN VIN (atsevišķs fails, nevis
 * `traficom_fi` bloks, lai releja atbildes neplūstu caur klienta autosave sapludināšanu). Blokā dati nonāk caur
 * to pašu Traficom parseri, ko lieto PDF augšupielāde / ielīmējums (`lib/traficom-report-parse.ts`).
 */

export type TraficomFiAutoState =
  | "skipped"
  | "not_configured"
  | "queued"
  | "awaiting_eparaksts"
  | "awaiting_browser_code"
  | "searching"
  | "found"
  | "not_found"
  | "error";

/** Releja strukturētie dati (relay/provin-traficom/lib/traficom-page.mjs `buildTraficomData`). */
export type TraficomFiFlag = { level: "red" | "yellow"; text: string };
export type TraficomFiSection = { title: string; rows: [string, string][] };
export type TraficomFiData = {
  vehicleTitle: string;
  banners: string[];
  summary: [string, string][];
  flags: TraficomFiFlag[];
  source: string;
  sections: TraficomFiSection[];
};

export type TraficomFiPdf = {
  dropboxPath: string;
  name: string;
  size: number;
  savedAt: string;
};

export type TraficomFiAutoStatus = {
  state: TraficomFiAutoState;
  vin?: string;
  jobId?: string;
  /** eParaksts kontrolkods (ja lapa to rāda) - tikai kamēr `awaiting_eparaksts`. */
  verificationCode?: string;
  /** eParaksts "confirm this browser": līdz kuram laikam derīgs kods lietotnē (ISO) - tikai kamēr `awaiting_browser_code`. */
  codeExpiresAt?: string;
  /** Koda termiņš beidzies - jāspiež «Pieprasīt jaunu kodu». */
  codeExpired?: boolean;
  /** Kurš mēģinājums (1, 2, ...). */
  browserCodeAttempt?: number;
  /** Iepriekšējo kodu eParaksts nepieņēma. */
  browserCodeRejected?: boolean;
  /** Latvisks paskaidrojums adminam (bez personas datiem). */
  message?: string;
  requestedAt?: string;
  updatedAt: string;
  checkedAt?: string;
  /** Teksta kopija Traficom parserim (tas pats formāts kā PDF / ielīmējums). */
  rawText?: string;
  data?: TraficomFiData;
  /** Rezultāts no releja keša (7 d), nevis jauns vaicājums. */
  cached?: boolean;
  /** Bezmaksas PDF pasūtījuma Dropbox mapē. */
  pdf?: TraficomFiPdf;
  /** Kad dati ievietoti `traficom_fi` blokā (automātiski vai ar pogu). */
  appliedAt?: string;
  appliedBy?: "auto" | "manual";
  /** Bloka RAW pirms Traficom ievietošanas (atjaunojams ar «Atjaunot iepriekšējo RAW»). */
  previousRawText?: string;
  previousRawSavedAt?: string;
  restoredAt?: string;
  errorCode?: string;
  trigger?: "auto" | "manual";
  /** Kāpēc automātika palaida (FI pazīme: "car.info", "FI numurs", ...). */
  reason?: string;
};

/** Releja sesijas skats (`GET /traficom/session`). */
export type TraficomFiRelaySession = {
  state: "logged_out" | "awaiting_eparaksts" | "awaiting_browser_code" | "active" | "expired";
  verificationCode?: string;
  codeExpiresAt?: string;
  codeExpired?: boolean;
  browserCodeAttempt?: number;
  browserCodeRejected?: boolean;
  activeSince?: string;
  lastOkAt?: string;
  lastLookupAt?: string;
  lastError?: string;
  updatedAt?: string;
};

export const TRAFICOM_FI_ACTIVE_STATES: readonly TraficomFiAutoState[] = ["queued", "awaiting_eparaksts", "awaiting_browser_code", "searching"];

export function isTraficomFiAutoActive(s: TraficomFiAutoStatus | null | undefined): boolean {
  return Boolean(s && TRAFICOM_FI_ACTIVE_STATES.includes(s.state));
}
