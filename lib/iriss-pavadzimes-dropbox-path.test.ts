import { describe, expect, it } from "vitest";
import {
  classifyDropboxWaybillPath,
  isDirectChildOfDropboxFolder,
  normalizeDropboxPath,
} from "@/lib/iriss-pavadzimes-dropbox-path";

describe("iriss-pavadzimes-dropbox-path", () => {
  it("normalizes paths", () => {
    expect(normalizeDropboxPath("/Pavadzīmes_IRISS/")).toBe("/Pavadzīmes_IRISS");
  });

  it("allows only direct children of the configured folder", () => {
    const folder = "/Pavadzīmes_IRISS";
    expect(isDirectChildOfDropboxFolder("/Pavadzīmes_IRISS/P02790.pdf", folder)).toBe(true);
    expect(isDirectChildOfDropboxFolder("/Pavadzīmes_IRISS/Arhīvs/P02700.pdf", folder)).toBe(false);
    expect(isDirectChildOfDropboxFolder("/Other/P02790.pdf", folder)).toBe(false);
  });

  it("supports app-folder root (empty folder path)", () => {
    expect(isDirectChildOfDropboxFolder("/P02790.pdf", "")).toBe(true);
    expect(isDirectChildOfDropboxFolder("/Arhīvs/P02700.pdf", "")).toBe(false);
  });

  it("classifies current vs Arhīvs waybills (arhivētās nepazūd no admin)", () => {
    const folder = "/Pavadzīmes_IRISS";
    expect(classifyDropboxWaybillPath("/Pavadzīmes_IRISS/P02800_Volvo_XC60_B762-7.pdf", folder)).toBe("current");
    expect(classifyDropboxWaybillPath("/Pavadzīmes_IRISS/Arhīvs/P00741_MB_V_klase_B192-7.pdf", folder)).toBe("archive");
    expect(classifyDropboxWaybillPath("/pavadzīmes_iriss/arhīvs/p02788_mb_vito116_b193-7.pdf", folder)).toBe("archive");
    expect(classifyDropboxWaybillPath("/Pavadzīmes_IRISS/Arhivs/P02788.pdf", folder)).toBe("archive");
    expect(classifyDropboxWaybillPath("/Pavadzīmes_IRISS/Cits/P02788.pdf", folder)).toBeNull();
    expect(classifyDropboxWaybillPath("/Pavadzīmes_IRISS/Arhīvs/2025/P01000.pdf", folder)).toBeNull();
    expect(classifyDropboxWaybillPath("/Other/P02790.pdf", folder)).toBeNull();
    expect(classifyDropboxWaybillPath("/Arhīvs/P02700.pdf", "")).toBe("archive");
    expect(classifyDropboxWaybillPath("/P02700.pdf", "")).toBe("current");
  });
});
