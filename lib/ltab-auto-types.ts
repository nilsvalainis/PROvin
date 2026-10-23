import type { LtabCertificate } from "@/lib/ltab-report-extract";

/**
 * LTAB automātiskās izziņas stāvoklis vienam pasūtījumam (atsevišķs fails, nevis avotu bloks,
 * lai releja atbildes neplūstu caur klienta autosave sapludināšanu).
 */

export type LtabAutoState =
  | "skipped"
  | "not_configured"
  | "queued"
  | "awaiting_smartid"
  | "searching"
  | "no_claims"
  | "claims"
  | "error";

export type LtabAutoPdf = {
  /** Dropbox ceļš pasūtījuma mapē, piem. `/_PROv/BMW 640i 2012 WBA.../LTAB - AB1234.pdf`. */
  dropboxPath: string;
  name: string;
  size: number;
  savedAt: string;
};

export type LtabAutoStatus = {
  state: LtabAutoState;
  /** Numurzīme, pēc kuras meklēja (tikai LV). */
  plate?: string;
  jobId?: string;
  /** Smart-ID kontrolkods (4 cipari) - tikai kamēr `awaiting_smartid`. */
  verificationCode?: string;
  /** Latvisks paskaidrojums adminam (bez personas datiem). */
  message?: string;
  requestedAt?: string;
  updatedAt: string;
  checkedAt?: string;
  pdf?: LtabAutoPdf;
  /** Izziņa no oriģinālā PDF (to pašu nolasa manuālā augšupielāde). */
  certificate?: LtabCertificate;
  /** Izziņas numurzīme vai marka neatbilst CSDD datiem - automātiski neievieto. */
  mismatch?: string;
  /** Kad rezultāts ievietots LTAB blokā (automātiski vai ar pogu). */
  appliedAt?: string;
  trigger?: "auto" | "manual";
};

export const LTAB_AUTO_ACTIVE_STATES: readonly LtabAutoState[] = ["queued", "awaiting_smartid", "searching"];

export function isLtabAutoActive(s: LtabAutoStatus | null | undefined): boolean {
  return Boolean(s && LTAB_AUTO_ACTIVE_STATES.includes(s.state));
}

/** Avotu sarakstā oriģinālais PDF tiek rādīts ar šo nosaukumu. */
export const LTAB_SOURCE_PDF_LABEL = "LTAB";
