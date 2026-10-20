import { describe, expect, it } from "vitest";

import {
  vinScanBrowserImportLog,
  vinScanHtmlLooksLikeChallenge,
  vinScanPageUrlForLog,
} from "@/lib/vin-scan/browser-import-log";

describe("vin-scan browser import log", () => {
  it("ņem host+ceļu, bez vaicājuma un bez HTML", () => {
    expect(vinScanPageUrlForLog("https://stat.vin/cars/WDD1173421N570488?ref=1")).toBe(
      "stat.vin/cars/WDD1173421N570488",
    );
    expect(vinScanHtmlLooksLikeChallenge("<html><title>Just a moment...</title></html>")).toBe(true);
    expect(vinScanHtmlLooksLikeChallenge("<html><h1>Mercedes VIN WDD1173421N570488 Copart</h1></html>")).toBe(false);
    const row = vinScanBrowserImportLog({
      route: "vin-scan",
      event: "import_rejected",
      error: "page_not_ready",
      id: "stat_vin",
      httpStatus: 403,
      pageUrl: "https://stat.vin/cars/WDD1173421N570488",
      html: "<html>Just a moment... Checking your browser</html>",
    });
    expect(row).toMatchObject({
      vinScanBrowser: true,
      route: "vin-scan",
      event: "import_rejected",
      error: "page_not_ready",
      id: "stat_vin",
      httpStatus: 403,
      finalUrl: "stat.vin/cars/WDD1173421N570488",
      challenge: true,
    });
    const dump = JSON.stringify(row);
    expect(dump).not.toMatch(/BLOB|TOKEN|sk-|rk_/i);
    expect(dump).not.toContain("Just a moment");
  });
});
