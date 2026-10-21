import { irissScanSaveFailureMessage } from "@/lib/iriss-scan-editor-save";

export const IRISS_SCAN_AUTOSAVE_DEBOUNCE_MS = 900;

export const IRISS_SCAN_AUTOSAVE_SAVED = "Saglabāts";
export const IRISS_SCAN_AUTOSAVE_SAVING = "Saglabā...";
export const IRISS_SCAN_SAVE_FAILED = "Neizdevās saglabāt";
export const IRISS_SCAN_SAVE_RETRY = "Mēģināt vēlreiz";
export const IRISS_SCAN_EMPTY_RECORD = "Nav ko saglabāt. Ieraksti VIN, marku vai saiti.";

export type IrissScanAutosaveHeader = typeof IRISS_SCAN_AUTOSAVE_SAVED | typeof IRISS_SCAN_AUTOSAVE_SAVING | "";

export function irissScanAutosaveHeader(saving: boolean, persisted = true): IrissScanAutosaveHeader {
  if (saving) return IRISS_SCAN_AUTOSAVE_SAVING;
  return persisted ? IRISS_SCAN_AUTOSAVE_SAVED : "";
}

export type IrissScanFieldNotice =
  | { kind: "empty"; text: typeof IRISS_SCAN_EMPTY_RECORD }
  | { kind: "failed"; text: typeof IRISS_SCAN_SAVE_FAILED; retry: typeof IRISS_SCAN_SAVE_RETRY }
  | { kind: "info"; text: string }
  | null;

export function irissScanFieldNotice(message: string | null | undefined): IrissScanFieldNotice {
  const t = (message ?? "").trim();
  if (!t) return null;
  if (t === IRISS_SCAN_EMPTY_RECORD || t === irissScanSaveFailureMessage(400, "empty_record")) {
    return { kind: "empty", text: IRISS_SCAN_EMPTY_RECORD };
  }
  if (t === "Tīkla kļūda" || t.startsWith("Kļūda ") || t.startsWith("Konflikts")) {
    return { kind: "failed", text: IRISS_SCAN_SAVE_FAILED, retry: IRISS_SCAN_SAVE_RETRY };
  }
  if (t === "Neizdevās saglabāt") {
    return { kind: "failed", text: IRISS_SCAN_SAVE_FAILED, retry: IRISS_SCAN_SAVE_RETRY };
  }
  return { kind: "info", text: t };
}
