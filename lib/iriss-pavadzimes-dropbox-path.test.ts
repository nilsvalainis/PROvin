import { describe, expect, it } from "vitest";
import { isDirectChildOfDropboxFolder, normalizeDropboxPath } from "@/lib/iriss-pavadzimes-dropbox-path";

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
});
