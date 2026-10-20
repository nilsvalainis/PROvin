import { describe, expect, it } from "vitest";
import { irissScanSaveFailureMessage } from "@/lib/iriss-scan-editor-save";
import {
  IRISS_SCAN_AUTOSAVE_SAVED,
  IRISS_SCAN_AUTOSAVE_SAVING,
  irissScanAutosaveHeader,
  irissScanFieldNotice,
} from "@/lib/iriss-scan-autosave";

describe("iriss scan autosave copy", () => {
  it("shows Saglabāts or Saglabā... in the header", () => {
    expect(irissScanAutosaveHeader(false)).toBe(IRISS_SCAN_AUTOSAVE_SAVED);
    expect(irissScanAutosaveHeader(true)).toBe(IRISS_SCAN_AUTOSAVE_SAVING);
  });

  it("keeps empty_record text at the field", () => {
    expect(irissScanFieldNotice(irissScanSaveFailureMessage(400, "empty_record"))).toEqual({
      kind: "empty",
      text: "Nav ko saglabāt. Ieraksti VIN, marku vai saiti.",
    });
  });

  it("maps network errors to Neizdevās saglabāt + retry", () => {
    expect(irissScanFieldNotice("Tīkla kļūda")).toEqual({
      kind: "failed",
      text: "Neizdevās saglabāt",
      retry: "Mēģināt vēlreiz",
    });
    expect(irissScanFieldNotice("Kļūda 500")?.kind).toBe("failed");
  });
});
