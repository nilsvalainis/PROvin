/**
 * CarVertical fona pirkuma stāvoklis vienam pasūtījumam (atsevišķs fails, nevis avotu bloks, lai releja atbildes
 * neplūstu caur klienta autosave sapludināšanu) un konta kredītu atlikuma kešs.
 */

export type CarverticalAutoState =
  | "not_configured"
  | "queued"
  | "awaiting_login"
  | "checking"
  | "purchasing"
  | "waiting_report"
  | "downloading"
  | "ready"
  | "error";

export type CarverticalAutoPdf = {
  /** Dropbox ceļš pasūtījuma mapē (`/_PROv/<Marka Modelis Gads VIN>/CarVertical - VIN.pdf`), ja saglabāts. */
  dropboxPath?: string;
  /** Vercel Blob ceļš (privāts) - avots "Ievietot" pogai, ja Dropbox nav pieejams. */
  blobPath?: string;
  name: string;
  size: number;
  savedAt: string;
};

export type CarverticalAutoStatus = {
  state: CarverticalAutoState;
  vin?: string;
  jobId?: string;
  /** Pogas klikšķa id: tas pats id otrreiz (dubultklikšķis) jaunu pirkumu nesāk. */
  requestId?: string;
  kind?: "purchase" | "report";
  /** Atskaite jau bija kontā (netika pirkta). */
  existing?: boolean;
  reportId?: string;
  message?: string;
  code?: string;
  requestedAt?: string;
  updatedAt: string;
  readyAt?: string;
  pdf?: CarverticalAutoPdf;
  /** Kad PDF dati ievietoti CarVertical blokā (automātiski vienreiz vai ar pogu). */
  appliedAt?: string;
};

export type CarverticalBalance = {
  credits: number | null;
  checkedAt: string;
  /** Rīgas datums (YYYY-MM-DD), kad pēdējo reizi sūtīts push par zemu atlikumu. */
  lowPushDay?: string;
};

export type CarverticalSessionState = "unknown" | "active" | "awaiting_code" | "logged_out" | "needs_human";

export const CARVERTICAL_AUTO_ACTIVE_STATES: readonly CarverticalAutoState[] = [
  "queued",
  "awaiting_login",
  "checking",
  "purchasing",
  "waiting_report",
  "downloading",
];

export function isCarverticalAutoActive(s: CarverticalAutoStatus | null | undefined): boolean {
  return Boolean(s && CARVERTICAL_AUTO_ACTIVE_STATES.includes(s.state));
}

/** Zem šī atlikums sarkanā krāsā + viens push Nilam dienā. */
export const CARVERTICAL_LOW_CREDITS = 5;
/** Atlikuma keša vecums, pēc kura to atjauno. */
export const CARVERTICAL_BALANCE_TTL_MS = 30 * 60_000;

export const CARVERTICAL_STATE_LABEL_LV: Record<CarverticalAutoState, string> = {
  not_configured: "CarVertical relejs nav pieslēgts",
  queued: "Gaida rindā",
  awaiting_login: "Gaida CarVertical pieteikšanos (kods e-pastā)",
  checking: "Pārbauda kontu un atskaites",
  purchasing: "Pērk ar 1 kredītu",
  waiting_report: "Gaida atskaiti",
  downloading: "Lejupielādē PDF",
  ready: "Atskaite saņemta",
  error: "Kļūda",
};
