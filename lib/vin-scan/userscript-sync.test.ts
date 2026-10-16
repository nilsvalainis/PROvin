import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  VIN_SCAN_BROWSER_CATALOG,
  VIN_SCAN_BROWSER_IDS,
  VIN_SCAN_REMOVED_IDS,
  VIN_SCAN_SOURCE_IDS,
  VIN_SCAN_USERSCRIPT_MIN,
  vinScanUserscriptMeetsMin,
  vinScanUserscriptMinLabel,
  vinScanUserscriptUpdateNeeded,
} from "@/lib/vin-scan/catalog";
import { VIN_SCAN_BROWSER_AUTO_CLICK_IDS } from "@/lib/vin-scan/browser-click-policy";

const ROOT = process.cwd();
const PUBLIC_SCRIPT = path.join(ROOT, "public/userscripts/provin-vin-autofill.user.js");
const ROOT_SCRIPT = path.join(ROOT, "provin-vin-autofill.user.js");

describe("userscript sync with VIN scan catalog", () => {
  const src = readFileSync(PUBLIC_SCRIPT, "utf8");

  it("versija un SCAN_URLS sakrīt ar katalogu", () => {
    expect(src).toMatch(/@version\s+1\.22\.0/);
    expect(src).toContain('const SCRIPT_VERSION = "1.22.0"');
    expect(src).toContain("// @connect      stat.vin");
    expect(src).toContain("// @connect      bid.cars");
    expect(src).toContain("// @connect      bidfax.info");
    expect(src).toContain("// @connect      checkcar.vin");
    expect(src).toContain("// @connect      plc.auction");
    expect(src).toContain("// @connect      www.carfax.eu");
    expect(src).toContain("// @connect      poctra.com");
    expect(src).toContain("// @connect      www.epolicija.lt");
    expect(src).toContain("// @connect      biluppgifter.se");
    expect(src).toContain("// @connect      www.nicb.org");
    expect(src).toContain("function fetchStatVinInBrowser(");
    expect(src).toContain("function fetchBlockedSourceInBrowser(");
    expect(src).toContain("function watchStatVinBrowserFetch()");
    expect(src).toContain("[data-provin-stat-vin-fetch]");
    expect(src).toContain("[data-provin-browser-fetch]");
    expect(src).toContain('"https://stat.vin/cars/" + encodeURIComponent(vin)');
    expect(src).toContain('id="__NEXT_DATA__"');
    expect(src).toContain("// @match        https://fu-regnr.transportstyrelsen.se/*");
    expect(src).toContain("// @match        https://carinfo.se/*");
    expect(src).toContain('const GM_SE_IMPORT = "provin_se_import"');
    expect(src).toContain("function swedishPageId()");
    expect(src).toContain("function watchSwedishImport()");
    expect(src).toContain("function pollSwedishImport()");
    expect(src).toContain("[data-provin-order-vin]");
    expect(src).toContain("Zviedrijas dati nosūtīti uz PROVIN");
    expect(src).toContain("biluppgifter: 1");
    expect(src).toContain("carinfo: 1");
    expect(src).toContain("const ARCHIVE_HTML_MAX = 900000");
    expect(src).toContain("function pageHtmlForImport()");
    expect(src).toContain("function withArchiveHtml(");
    expect(src).toContain("stat_vin: 1");
    expect(src).toContain("plc_auction: 1");
    expect(src).toContain("poctra: 1");
    expect(src).toContain("const SCAN_URLS = {");
    expect(src).toContain('plc_auction: "https://plc.auction/?vin="');
    expect(src).not.toContain("vp.gov.lv");
    expect(src).not.toContain("check-mot.service.gov.uk");
    expect(src).toContain('lt_itpr: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr="');
    expect(src).toContain('nicb: "https://www.nicb.org/vincheck?vin="');
    expect(src).toContain('bidfax: "https://bidfax.info/?s="');
    expect(src).toContain("// @match        https://plc.auction/*");
    expect(src).toContain("// @match        https://www.epolicija.lt/*");
    expect(src).not.toContain("// @match        https://www.vp.gov.lv/*");
    expect(src).toContain("// @match        https://www.nicb.org/*");
    for (const item of VIN_SCAN_BROWSER_CATALOG) {
      expect(src).toMatch(new RegExp(`${item.id}:\\s*"https://`));
    }
    expect(VIN_SCAN_SOURCE_IDS).toHaveLength(33);
    expect(VIN_SCAN_SOURCE_IDS).toContain("joj_copart_iaai");
    expect(VIN_SCAN_BROWSER_IDS).not.toContain("joj_copart_iaai");
    expect(VIN_SCAN_SOURCE_IDS).toContain("lt_itpr");
    expect(VIN_SCAN_SOURCE_IDS).toContain("vin_decode");
    expect(VIN_SCAN_SOURCE_IDS).toContain("csdd");
    expect(VIN_SCAN_SOURCE_IDS).toContain("nummerplade");
    expect(VIN_SCAN_SOURCE_IDS).toContain("carinfo");
    expect(VIN_SCAN_SOURCE_IDS).toContain("lkf_ee");
    expect(VIN_SCAN_SOURCE_IDS).toContain("rdw");
    expect(VIN_SCAN_SOURCE_IDS).toContain("bidfax");
    expect(VIN_SCAN_SOURCE_IDS).toContain("listing_history");
    expect(VIN_SCAN_BROWSER_IDS).toContain("plc_auction");
    expect(VIN_SCAN_BROWSER_IDS).toContain("checkcar_vin");
    expect(VIN_SCAN_BROWSER_IDS).not.toContain("vp_wanted");
    expect(VIN_SCAN_BROWSER_IDS).toContain("lt_itpr");
    expect(VIN_SCAN_BROWSER_IDS).toContain("nicb");
    expect(src).toContain('if (id === "checkcar_vin")');
    expect(src).toContain('if (id === "stat_vin")');
    expect(src).toContain("extractStatVinExtras");
    expect(src).toContain("pieprasījumu limits");
    expect(src).toContain('if (id === "plc_auction")');
    expect(src).toContain('if (id === "lt_itpr")');
    expect(src).toContain("sorry,\\s*could not find what you were looking for");
    expect(src).toContain("Nav ierakstu");
    expect(src).toContain("Nav meklēšanā");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).toContain("plc_auction");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("vp_wanted");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).toContain("lt_itpr");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("autodna_preview");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("vininspect");
    expect(src).not.toContain('id === "vininspect"');
    for (const removed of VIN_SCAN_REMOVED_IDS) {
      expect(VIN_SCAN_SOURCE_IDS).not.toContain(removed);
      expect(src).not.toMatch(new RegExp(`${removed}:\\s*"https://`));
    }
  });

  it("kataloga URL un SCAN_URLS ved uz tiem pašiem hostiem", () => {
    const vin = "WBA5R1C0XLFH42873";
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "checkcar_vin")?.openUrl(vin)).toBe(
      `https://checkcar.vin/report/check/${vin}`,
    );
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "plc_auction")?.openUrl(vin)).toBe(
      `https://plc.auction/?vin=${vin}`,
    );
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "lt_itpr")?.openUrl(vin)).toBe(
      `https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=${vin}`,
    );
    expect(src).toContain("https://checkcar.vin/report/check/");
  });

  it("minimālā paneļa versija ir 1.22", () => {
    expect(vinScanUserscriptMinLabel()).toBe("1.22");
    expect(VIN_SCAN_USERSCRIPT_MIN).toEqual({ major: 1, minor: 22 });
    expect(vinScanUserscriptMeetsMin("1.21.0")).toBe(false);
    expect(vinScanUserscriptMeetsMin("1.22.0")).toBe(true);
    expect(vinScanUserscriptMeetsMin("2.0.0")).toBe(true);
    expect(vinScanUserscriptUpdateNeeded("")).toBe(false);
    expect(vinScanUserscriptUpdateNeeded("1.21.0")).toBe(true);
    expect(vinScanUserscriptUpdateNeeded("1.22.0")).toBe(false);
    const card = readFileSync(path.join(ROOT, "components/admin/AdminOrderVinScanCard.tsx"), "utf8");
    const hint = readFileSync(path.join(ROOT, "components/admin/AdminUserscriptUpdateHint.tsx"), "utf8");
    expect(card).toContain("data-provin-order-vin");
    expect(card).toContain("Lapa vēl nav gatava");
    expect(hint).toContain("Zviedrijas reģistrs");
    expect(hint).toContain("PROVIN skripts nav aktīvs");
    expect(hint).toContain("stat.vin dati jāielādē no jūsu pārlūka");
    expect(card).toContain("data-provin-stat-vin-fetch");
    expect(card).toContain("data-provin-browser-fetch");
  });

  it("saknes kopija sakrīt ar public skriptu", () => {
    expect(readFileSync(ROOT_SCRIPT, "utf8")).toBe(src);
  });
});
