import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  VIN_SCAN_BROWSER_CATALOG,
  VIN_SCAN_BROWSER_IDS,
  VIN_SCAN_USERSCRIPT_MIN,
  vinScanUserscriptMeetsMin,
  vinScanUserscriptMinLabel,
} from "@/lib/vin-scan/catalog";
import { VIN_SCAN_BROWSER_AUTO_CLICK_IDS } from "@/lib/vin-scan/browser-click-policy";

const ROOT = process.cwd();
const PUBLIC_SCRIPT = path.join(ROOT, "public/userscripts/provin-vin-autofill.user.js");
const ROOT_SCRIPT = path.join(ROOT, "provin-vin-autofill.user.js");

describe("userscript sync with VIN scan catalog", () => {
  const src = readFileSync(PUBLIC_SCRIPT, "utf8");

  it("versija un SCAN_URLS sakrīt ar katalogu", () => {
    expect(src).toMatch(/@version\s+1\.11\.0/);
    expect(src).toContain('const SCRIPT_VERSION = "1.11.0"');
    expect(src).toContain("const SCAN_URLS = {");
    expect(src).toContain('plc_auction: "https://plc.auction/"');
    expect(src).toContain("// @match        https://plc.auction/*");
    for (const item of VIN_SCAN_BROWSER_CATALOG) {
      expect(src).toMatch(new RegExp(`${item.id}:\\s*"https://`));
    }
    expect(VIN_SCAN_BROWSER_IDS).toContain("plc_auction");
    expect(VIN_SCAN_BROWSER_IDS).toContain("checkcar_vin");
    expect(VIN_SCAN_BROWSER_IDS).toContain("autodna_preview");
    expect(src).toContain('if (id === "checkcar_vin")');
    expect(src).toContain('if (id === "plc_auction")');
    expect(src).toContain("sorry,\\s*could not find what you were looking for");
    expect(src).toContain("Nav ierakstu");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).toContain("plc_auction");
    expect(src).toContain('id === "plc_auction"');
  });

  it("kataloga URL un SCAN_URLS ved uz tiem pašiem hostiem", () => {
    const vin = "WBA5R1C0XLFH42873";
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "checkcar_vin")?.openUrl(vin)).toBe(
      `https://checkcar.vin/report/check/${vin}`,
    );
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "plc_auction")?.openUrl(vin)).toBe("https://plc.auction/");
    expect(src).toContain("https://checkcar.vin/report/check/");
  });

  it("minimālā paneļa versija ir 1.11", () => {
    expect(vinScanUserscriptMinLabel()).toBe("1.11");
    expect(VIN_SCAN_USERSCRIPT_MIN).toEqual({ major: 1, minor: 11 });
    expect(vinScanUserscriptMeetsMin("1.10.0")).toBe(false);
    expect(vinScanUserscriptMeetsMin("1.11.0")).toBe(true);
    expect(vinScanUserscriptMeetsMin("2.0.0")).toBe(true);
  });

  it("saknes kopija nesakrīt ar public skriptu tikai ja tās atšķiras", () => {
    expect(readFileSync(ROOT_SCRIPT, "utf8")).toBe(src);
  });
});
