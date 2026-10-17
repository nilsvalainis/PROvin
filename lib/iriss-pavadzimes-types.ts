/**
 * IRISS CSDD transporta pavadzīmes (SIA ĪRISS).
 * Avots: Dropbox `/Pavadzīmes_IRISS` vai manuāla PDF augšupielāde Blob/disku.
 */

export type IrissPavadzimeSource = "dropbox" | "upload";

export type IrissPavadzimeValidityTone = "expired" | "today" | "ok" | "unknown";

export type IrissPavadzimeRecord = {
  id: string;
  number: string;
  brandModel: string;
  vin: string;
  plate: string;
  /** ISO 8601 (Europe/Riga vietējais laiks konvertēts uz UTC). Tukšs, ja nav izdevies parsēt. */
  issuedAt: string;
  /** ISO 8601 derīguma beigas. */
  validUntil: string;
  fileName: string;
  source: IrissPavadzimeSource;
  dropboxId: string;
  dropboxPath: string;
  dropboxRev: string;
  dropboxContentHash: string;
  /** Blob/FS ceļš, ja PDF ir kešots vai augšupielādēts. */
  blobPath: string;
  parsedAt: string;
  updatedAt: string;
  /** Dropbox `Arhīvs/` (vai fails vairs nav Dropbox). Ieraksts paliek sarakstā. */
  archived?: boolean;
};

/** active = derīga; expired = termiņš beidzies; interrupted = pārtraukta (tam pašam nr. izdota jaunāka pirms termiņa). */
export type IrissPavadzimeLifecycle = "active" | "expired" | "interrupted" | "unknown";

export type IrissPavadzimeOrderMatch = {
  id: string;
  label: string;
};

export type IrissPavadzimeListRow = IrissPavadzimeRecord & {
  validityTone: IrissPavadzimeValidityTone;
  order: IrissPavadzimeOrderMatch | null;
  lifecycle?: IrissPavadzimeLifecycle;
  /** Pārtrauktai pavadzīmei: jaunākās pavadzīmes nr. */
  supersededBy?: string;
};

export type IrissPavadzimesIndex = {
  version: 1;
  updatedAt: string;
  items: IrissPavadzimeRecord[];
};

export function emptyIrissPavadzimeRecord(id: string, nowIso: string): IrissPavadzimeRecord {
  return {
    id,
    number: "",
    brandModel: "",
    vin: "",
    plate: "",
    issuedAt: "",
    validUntil: "",
    fileName: "",
    source: "upload",
    dropboxId: "",
    dropboxPath: "",
    dropboxRev: "",
    dropboxContentHash: "",
    blobPath: "",
    parsedAt: nowIso,
    updatedAt: nowIso,
  };
}
