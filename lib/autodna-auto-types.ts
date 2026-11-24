/**
 * AutoDNA fona pirkuma stāvoklis vienam pasūtījumam (atsevišķs fails, nevis avotu bloks - releja atbildes neplūst caur
 * klienta autosave sapludināšanu) un konta kredītu atlikuma kešs. Tā pati forma kā CarVertical fona pirkumam.
 */
import type { CarverticalBalance } from "@/lib/carvertical-auto-types";

export type AutodnaAutoState =
  | "not_configured"
  | "queued"
  | "awaiting_login"
  | "checking"
  | "purchasing"
  | "waiting_report"
  | "downloading"
  | "ready"
  | "error";

export type AutodnaAutoPdf = {
  /** Dropbox ceļš pasūtījuma mapē (`/_PROv/<Marka Modelis Gads VIN>/AutoDNA - VIN.pdf`), ja saglabāts. */
  dropboxPath?: string;
  /** Vercel Blob ceļš (privāts) - avots "Ievietot" pogai, ja Dropbox nav pieejams. */
  blobPath?: string;
  name: string;
  size: number;
  savedAt: string;
};

export type AutodnaAutoStatus = {
  state: AutodnaAutoState;
  vin?: string;
  jobId?: string;
  /** Pogas klikšķa id: tas pats id otrreiz (dubultklikšķis) jaunu pirkumu nesāk. */
  requestId?: string;
  kind?: "purchase" | "report";
  /** Atskaite jau bija kontā (netika pirkta). */
  existing?: boolean;
  message?: string;
  code?: string;
  requestedAt?: string;
  updatedAt: string;
  readyAt?: string;
  pdf?: AutodnaAutoPdf;
  /** Kad PDF dati ievietoti AutoDNA blokā (automātiski vienreiz vai ar pogu). */
  appliedAt?: string;
};

/** Tā pati forma kā CarVertical atlikumam (kredīti, pārbaudes laiks, pēdējā zemā atlikuma push diena). */
export type AutodnaBalance = CarverticalBalance;

export type AutodnaSessionState = "unknown" | "active" | "logged_out" | "needs_human";

export const AUTODNA_AUTO_ACTIVE_STATES: readonly AutodnaAutoState[] = [
  "queued",
  "awaiting_login",
  "checking",
  "purchasing",
  "waiting_report",
  "downloading",
];

export function isAutodnaAutoActive(s: AutodnaAutoStatus | null | undefined): boolean {
  return Boolean(s && AUTODNA_AUTO_ACTIVE_STATES.includes(s.state));
}

export const AUTODNA_STATE_LABEL_LV: Record<AutodnaAutoState, string> = {
  not_configured: "AutoDNA relejs nav pieslēgts",
  queued: "Gaida rindā",
  awaiting_login: "Gaida AutoDNA pieteikšanos",
  checking: "Pārbauda kontu un atskaites",
  purchasing: "Pērk ar 1 kredītu",
  waiting_report: "Gaida atskaiti",
  downloading: "Lejupielādē PDF",
  ready: "Atskaite saņemta",
  error: "Kļūda",
};
