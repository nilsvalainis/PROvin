import { describe, expect, it } from "vitest";
import { SOURCE_BLOCK_EXTERNAL_URL } from "@/lib/admin-source-blocks";
import {
  AUTODNA_LV_HOME_URL,
  AUTORECORDS_BASE_URL,
  CARINFO_HOME_URL,
  CARVERTICAL_REPORTS_URL,
  CHECKTHISREG_HOME_URL,
  buildAutodnaVinCheckUrl,
  buildAutorecordsVinCheckUrl,
  buildCarinfoVinCheckUrl,
  buildCarverticalVinCheckUrl,
  buildCheckthisregVinCheckUrl,
  buildVinAutofillHref,
  normalizeVinForServiceUrls,
  resolveSourceBlockExternalOpen,
} from "@/lib/admin-vin-urls";

describe("admin VIN service URLs", () => {
  const vin = "WVWZZZ1JZXW000001";

  it("normalizes spaces and dashes", () => {
    expect(normalizeVinForServiceUrls(" wv-wzzz 1jzxw000001 ")).toBe(vin);
  });

  it("opens AutoDNA on autodna.lv with VIN in the path", () => {
    expect(buildAutodnaVinCheckUrl(vin)).toBe(`${AUTODNA_LV_HOME_URL}/vin/${vin}`);
    expect(buildAutodnaVinCheckUrl(vin)).not.toContain("autodna.com");
  });

  it("opens CarVertical on the Latvian reports page, not .lv homepage", () => {
    expect(buildCarverticalVinCheckUrl(vin)).toBe(CARVERTICAL_REPORTS_URL);
    expect(buildCarverticalVinCheckUrl(vin)).toContain("carvertical.com/lv/user/reports");
    expect(buildCarverticalVinCheckUrl(vin)).not.toContain("carvertical.lv");
  });

  it("keeps Auto-Records ?vin= query", () => {
    expect(buildAutorecordsVinCheckUrl(vin)).toBe(`${AUTORECORDS_BASE_URL.replace(/\/$/, "")}/?vin=${vin}`);
  });

  it("opens car.info homepage (search?q= is a 404); VIN is filled in the header", () => {
    expect(buildCarinfoVinCheckUrl(vin)).toBe(CARINFO_HOME_URL);
    expect(buildVinAutofillHref("carinfo", vin)).not.toContain("search?q=");
    expect(resolveSourceBlockExternalOpen("carinfo", vin).handoffVin).toBe(vin);
  });

  it("opens CheckThisReg homepage for Tampermonkey VIN tab fill", () => {
    expect(buildCheckthisregVinCheckUrl(vin)).toBe(CHECKTHISREG_HOME_URL);
    expect(buildVinAutofillHref("checkthisreg", vin)).toBe(CHECKTHISREG_HOME_URL);
  });

  it("returns null without VIN", () => {
    expect(buildAutodnaVinCheckUrl("")).toBeNull();
    expect(buildCarverticalVinCheckUrl("   ")).toBeNull();
    expect(buildCheckthisregVinCheckUrl("")).toBeNull();
    expect(buildCarinfoVinCheckUrl("")).toBeNull();
  });

  it("resolves source-block headers to the same live URLs", () => {
    expect(resolveSourceBlockExternalOpen("autodna", vin).href).toBe(`${AUTODNA_LV_HOME_URL}/vin/${vin}`);
    expect(resolveSourceBlockExternalOpen("carvertical", vin).href).toBe(CARVERTICAL_REPORTS_URL);
    expect(resolveSourceBlockExternalOpen("carinfo", vin).href).toBe(CARINFO_HOME_URL);
    expect(resolveSourceBlockExternalOpen("autodna", "").href).toBe(AUTODNA_LV_HOME_URL);
  });

  it("keeps admin source-block headers on the same live hosts", () => {
    expect(SOURCE_BLOCK_EXTERNAL_URL.autodna).toBe(AUTODNA_LV_HOME_URL);
    expect(SOURCE_BLOCK_EXTERNAL_URL.autodna).not.toContain("autodna.com");
    expect(SOURCE_BLOCK_EXTERNAL_URL.carvertical).toBe(CARVERTICAL_REPORTS_URL);
    expect(SOURCE_BLOCK_EXTERNAL_URL.carvertical).not.toContain("carvertical.lv");
  });
});
