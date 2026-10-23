import { describe, expect, it } from "vitest";
import { waybillPdfSaveMode } from "@/components/admin/IrissWaybillSavePdfButton";

describe("Saglabāt PDF mode", () => {
  it("iPhone: share sheet with the file when supported, otherwise open the PDF in a new tab", () => {
    expect(waybillPdfSaveMode({ ios: true, canShareFiles: true })).toBe("share");
    expect(waybillPdfSaveMode({ ios: true, canShareFiles: false })).toBe("open");
  });
  it("desktop: download", () => {
    expect(waybillPdfSaveMode({ ios: false, canShareFiles: true })).toBe("download");
    expect(waybillPdfSaveMode({ ios: false, canShareFiles: false })).toBe("download");
  });
});
