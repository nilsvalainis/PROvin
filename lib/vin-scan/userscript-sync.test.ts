import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { AdminVinScanBrowserFetchHandoff } from "@/components/admin/AdminVinScanBrowserFetchHandoff";
import { PROVIN_USERSCRIPT_ATTR, PROVIN_USERSCRIPT_PING_EVENT, PROVIN_USERSCRIPT_PONG_EVENT } from "@/lib/provin-userscript-presence";
import { renderHtml } from "@/lib/test-render";
import {
  VIN_SCAN_BROWSER_CATALOG,
  VIN_SCAN_BROWSER_IDS,
  VIN_SCAN_REMOVED_IDS,
  VIN_SCAN_SOURCE_IDS,
  VIN_SCAN_USERSCRIPT_MIN,
  vinScanCatalogItem,
  vinScanUserscriptMeetsMin,
  vinScanUserscriptMinLabel,
  vinScanUserscriptUpdateNeeded,
  vwGroupRecallCheckUrl,
} from "@/lib/vin-scan/catalog";
import { VIN_SCAN_BROWSER_AUTO_CLICK_IDS } from "@/lib/vin-scan/browser-click-policy";
import {
  VIN_SCAN_BROWSER_FETCH_IDS,
  browserFetchLane,
  browserFetchSummary,
  browserImportErrorLv,
  parseVinScanBrowserEventDetail,
} from "@/lib/vin-scan/browser-fetch";
import {
  FakeElement,
  USERSCRIPT_ROOT_PATH,
  parseUserscriptMeta,
  readUserscriptSource,
  runUserscriptAt,
  userscriptConnectAllows,
  userscriptMatchesUrl,
} from "@/lib/vin-scan/test-helpers/userscript-vm";

const VIN = "WBA5R1C0XLFH42873";
const ADMIN = "https://www.provin.lv/admin/vin-scan";
const ADMIN_ORDER = "https://www.provin.lv/admin/orders/x";
const src = readUserscriptSource();
const meta = parseUserscriptMeta(src);

type ScanResult = {
  id?: string;
  vin?: string;
  status?: string;
  summary?: string;
  html?: string;
  pageUrl?: string;
  finalUrl?: string;
  httpStatus?: number;
  auctions?: { title?: string; venue?: string }[];
};

/** URL, ko skripts atver nākamajam avotam skenēšanas rindā (pēc tam, kad pirmais avots atbildējis). */
function scanQueueUrl(id: string): string {
  const run = runUserscriptAt(ADMIN);
  run.fire("provin-vin-scan-browser", { vin: VIN, sources: ["stat_vin", id] });
  run.gm.set.set("provin_scan_result", JSON.stringify({ id: "stat_vin", vin: VIN, status: "none" }));
  run.tickIntervals();
  expect(run.errors).toEqual([]);
  return run.opened[0]?.url ?? "";
}

/** Palaiž skriptu avota lapā, kamēr skenēšanas rindā aktīvs ir šis avots, un atgriež publicēto rezultātu. */
function probeSourcePage(id: string, href: string, bodyText: string, pageHtml = `<html><body>${bodyText}</body></html>`) {
  const run = runUserscriptAt(href, {
    gm: { provin_scan_job: JSON.stringify({ vin: VIN, sources: [id], index: 0, startedAt: Date.parse("2026-11-17T10:00:00.000Z") }) },
    bodyText,
    pageHtml,
  });
  for (let i = 0; i < 30 && !run.gm.set.has("provin_scan_result"); i += 1) run.tickIntervals();
  const raw = run.gm.set.get("provin_scan_result");
  expect(run.errors).toEqual([]);
  return { run, result: raw ? (JSON.parse(String(raw)) as ScanResult) : null };
}

function scanResults(run: ReturnType<typeof runUserscriptAt>): ScanResult[] {
  return run.dispatched.filter((ev) => ev.type === "provin-vin-scan-result").map((ev) => ev.detail as ScanResult);
}

/*
 * Metadatu galvene ir līgums ar Tampermonkey (kur skripts drīkst darboties un uz kurieni drīkst sūtīt
 * pieprasījumus), ko nevar izpildīt kā kodu. Tāpēc to nolasa struktūrā un pārbauda pret katalogu,
 * nevis meklē atsevišķas teksta rindas.
 */
describe("userscript metadati pret VIN SCAN katalogu", () => {
  it("versija galvenē ir tā, ko skripts paziņo adminam, un der paneļa minimumam", () => {
    const run = runUserscriptAt(ADMIN);
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(run.html.getAttribute(PROVIN_USERSCRIPT_ATTR)).toBe(meta.version);
    expect(run.window.__provinUserscriptVersion).toBe(meta.version);
    expect(vinScanUserscriptMeetsMin(meta.version)).toBe(true);
    expect(vinScanUserscriptUpdateNeeded(meta.version)).toBe(false);
    expect(meta.sandbox).toBe("raw");
  });

  it("atjauninājuma saite ved uz publisko skripta failu, ko piedāvā admin", () => {
    expect(meta.updateURL).toBe("https://www.provin.lv/userscripts/provin-vin-autofill.user.js");
    expect(meta.downloadURL).toBe(meta.updateURL);
  });

  it("@match: admin tikai PROVIN hostos, bez aizstājējzīmju apakšdomēniem", () => {
    const adminHosts = meta.match.filter((p) => /\/admin\*$/.test(p)).map((p) => p.replace(/\/admin\*$/, ""));
    expect(adminHosts.sort()).toEqual(
      ["http://127.0.0.1:*", "http://localhost:*", "https://provin.lv", "https://www.provin.lv"].sort(),
    );
    for (const pattern of meta.match) {
      expect(pattern, pattern).not.toMatch(/^\*:|:\/\/\*\.|:\/\/\*\//);
    }
    expect(userscriptMatchesUrl(meta, "https://www.provin.lv/admin/orders/x")).toBe(true);
    expect(userscriptMatchesUrl(meta, "http://localhost:3000/admin")).toBe(true);
    expect(userscriptMatchesUrl(meta, "https://evil.vercel.app/admin")).toBe(false);
    expect(userscriptMatchesUrl(meta, "https://www.provin.lv/lv")).toBe(false);
  });

  it("@match sedz katra pārlūka avota lapu un Zviedrijas reģistrus; noņemtie hosti nav", () => {
    for (const item of VIN_SCAN_BROWSER_CATALOG) {
      expect(userscriptMatchesUrl(meta, item.openUrl(VIN)), item.id).toBe(true);
    }
    expect(userscriptMatchesUrl(meta, "https://fu-regnr.transportstyrelsen.se/extweb/sok")).toBe(true);
    expect(userscriptMatchesUrl(meta, "https://carinfo.se/fordon/abc123")).toBe(true);
    expect(userscriptMatchesUrl(meta, vwGroupRecallCheckUrl(VIN))).toBe(true);
    expect(userscriptMatchesUrl(meta, "https://www.vp.gov.lv/lv/mekletie-transportlidzekli")).toBe(false);
    expect(userscriptMatchesUrl(meta, "https://www.check-mot.service.gov.uk/")).toBe(false);
    expect(userscriptMatchesUrl(meta, "https://www.volkswagen.co.uk/en/owners-and-services/recalls.html")).toBe(false);
  });

  it("@connect atļauj visus no pārlūka ielādējamos avotus un sludinājumu vēsturi, bez '*'", () => {
    expect(meta.connect).not.toContain("*");
    for (const id of VIN_SCAN_BROWSER_FETCH_IDS) {
      expect(userscriptConnectAllows(meta, new URL(vinScanCatalogItem(id).openUrl(VIN)).hostname), id).toBe(true);
    }
    expect(userscriptConnectAllows(meta, "tirgusdati.lv")).toBe(true);
    expect(userscriptConnectAllows(meta, "adify.lv")).toBe(true);
    expect(userscriptConnectAllows(meta, "www.vp.gov.lv")).toBe(false);
    expect(userscriptConnectAllows(meta, "www.carvertical.com")).toBe(false);
    expect(meta.grant).toEqual(
      expect.arrayContaining(["GM_getValue", "GM_setValue", "GM_deleteValue", "GM_xmlhttpRequest"]),
    );
  });

  it("saknes kopija sakrīt ar public skriptu", () => {
    expect(readFileSync(USERSCRIPT_ROOT_PATH, "utf8")).toBe(src);
  });
});

describe("userscript admin lapā: klātbūtne", () => {
  it("uz ping atbild ar pong un savu versiju", () => {
    const run = runUserscriptAt(ADMIN);
    const before = run.dispatched.length;
    run.fire(PROVIN_USERSCRIPT_PING_EVENT);
    const pongs = run.dispatched.slice(before).filter((ev) => ev.type === PROVIN_USERSCRIPT_PONG_EVENT);
    expect(pongs).toEqual([{ type: PROVIN_USERSCRIPT_PONG_EVENT, detail: meta.version }]);
  });

  it("pēc React noņemta <html> atribūta ping to uzliek atpakaļ", () => {
    const run = runUserscriptAt(ADMIN);
    run.html.removeAttribute(PROVIN_USERSCRIPT_ATTR);
    run.fire(PROVIN_USERSCRIPT_PING_EVENT);
    expect(run.html.getAttribute(PROVIN_USERSCRIPT_ATTR)).toBe(meta.version);
  });
});

describe("userscript admin lapā: ielāde no pārlūka (from browser)", () => {
  it("katram from-browser avotam pieprasa tieši kataloga URL, ar operatora sīkdatnēm", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: [...VIN_SCAN_BROWSER_FETCH_IDS] });
    expect(run.gm.xhr.map((req) => req.url)).toEqual(
      VIN_SCAN_BROWSER_FETCH_IDS.map((id) => vinScanCatalogItem(id).openUrl(VIN)),
    );
    for (const req of run.gm.xhr) {
      expect(req.method).toBe("GET");
      expect(req.anonymous, req.url).toBe(false);
    }
  });

  it("avotu, kas nav from-browser sarakstā, no pārlūka nelasa; nederīgs VIN neko nepieprasa", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["csdd", "carvertical_preview", "vp_wanted"] });
    run.fire("provin-browser-fetch", { vin: "nav vin", at: "t1", ids: ["stat_vin"] });
    expect(run.gm.xhr).toHaveLength(0);
  });

  it("provin-stat-vin-fetch notikums ielādē stat.vin lapu", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-stat-vin-fetch", { vin: VIN, at: "t1" });
    expect(run.gm.xhr.map((req) => req.url)).toEqual([vinScanCatalogItem("stat_vin").openUrl(VIN)]);
  });

  it("to pašu pieprasījumu (VIN + laiks) neatkārto; jauns skenējums ielādē vēlreiz", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["bid_cars"] });
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["bid_cars"] });
    expect(run.gm.xhr).toHaveLength(1);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t2", ids: ["bid_cars"] });
    expect(run.gm.xhr).toHaveLength(2);
  });

  it("admin renderētais marķieris palaiž ielādi uzreiz pēc lapas atvēršanas", () => {
    const at = "2026-11-17T10:00:00.000Z";
    const html = renderHtml(
      createElement(AdminVinScanBrowserFetchHandoff, {
        vin: VIN,
        at,
        rows: [
          { id: "stat_vin", ...browserFetchLane("stat_vin") },
          { id: "nicb", ...browserFetchLane("nicb") },
          { id: "bid_cars", status: "found", summary: "Ir izsoles ieraksts" },
        ],
      }),
    );
    const attrs = Object.fromEntries([...html.matchAll(/\s([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
    expect(attrs["data-provin-order-vin"]).toBe(VIN);
    const marker = new FakeElement("span", { attrs });
    const run = runUserscriptAt(ADMIN_ORDER, { elements: [marker] });
    expect(run.gm.xhr.map((req) => req.url).sort()).toEqual(
      [vinScanCatalogItem("stat_vin").openUrl(VIN), vinScanCatalogItem("nicb").openUrl(VIN)].sort(),
    );
  });

  it("marķieri, ko SPA ieliek vēlāk, pamana arī bez lapas pārlādes", () => {
    const elements: FakeElement[] = [];
    const run = runUserscriptAt(ADMIN_ORDER, { elements });
    expect(run.gm.xhr).toHaveLength(0);
    /* SPA pāreja ieliek jaunu <span>, nevis maina atribūtu - novērotājam jāskatās arī childList. */
    expect(run.observers.some((o) => o.options.childList === true && o.options.subtree === true)).toBe(true);
    elements.push(
      new FakeElement("span", {
        attrs: { "data-provin-browser-fetch": `${VIN}:t9`, "data-provin-browser-fetch-ids": "poctra" },
      }),
    );
    run.tickIntervals();
    expect(run.gm.xhr.map((req) => req.url)).toEqual([vinScanCatalogItem("poctra").openUrl(VIN)]);
  });

  it("atbildi nodod adminam kā provin-vin-scan-result ar HTML un galīgo URL", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["bidfax", "poctra"] });
    const [bidfax, poctra] = run.gm.xhr;
    bidfax!.onload!({ status: 200, responseText: `<p>${VIN} lot sold</p>`, finalUrl: "https://bidfax.info/bmw/x.html" });
    poctra!.onload!({ status: 200, responseText: `<p>${VIN}</p>` });
    const results = scanResults(run);
    expect(results[0]).toMatchObject({
      id: "bidfax",
      vin: VIN,
      html: `<p>${VIN} lot sold</p>`,
      finalUrl: "https://bidfax.info/bmw/x.html",
      pageUrl: "https://bidfax.info/bmw/x.html",
      httpStatus: 200,
    });
    expect(results[1]).toMatchObject({ id: "poctra", finalUrl: vinScanCatalogItem("poctra").openUrl(VIN) });
    /* Admin puse šo notikumu pieņem (tas pats līgums, ko lasa panelis un pasūtījuma kartīte). */
    expect(parseVinScanBrowserEventDetail(results[0])).toMatchObject({ id: "bidfax", vin: VIN });
  });

  it("Cloudflare izaicinājumu mēģina kopā 3 reizes, tad atdod pēdējo atbildi", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["bid_cars"] });
    const challenge = { status: 403, responseText: "<title>Just a moment...</title>" };
    run.gm.xhr[0]!.onload!(challenge);
    expect(scanResults(run)).toHaveLength(0);
    run.flushTimeouts();
    expect(run.gm.xhr).toHaveLength(2);
    run.gm.xhr[1]!.onload!(challenge);
    run.flushTimeouts();
    expect(run.gm.xhr).toHaveLength(3);
    run.gm.xhr[2]!.onload!(challenge);
    run.flushTimeouts();
    expect(run.gm.xhr).toHaveLength(3);
    expect(scanResults(run)).toHaveLength(1);
    expect(scanResults(run)[0]).toMatchObject({ id: "bid_cars", httpStatus: 403 });
  });

  it("tīkla kļūdu atkārto, bet ne bezgalīgi", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["nicb"] });
    for (let i = 0; i < 6; i += 1) {
      run.gm.xhr[run.gm.xhr.length - 1]!.onerror!();
      run.flushTimeouts();
    }
    expect(run.gm.xhr).toHaveLength(3);
    expect(scanResults(run)).toHaveLength(0);
  });

  it("pieprasījumu limits (429) netiek atkārtots un adminam tiek pateikts ar avota nosaukumu", () => {
    for (const id of VIN_SCAN_BROWSER_FETCH_IDS) {
      const run = runUserscriptAt(ADMIN);
      run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: [id] });
      run.gm.xhr[0]!.onload!({ status: 429, responseText: "Too many requests" });
      run.flushTimeouts();
      expect(run.gm.xhr, id).toHaveLength(1);
      const label = browserFetchSummary(id).split(":")[0];
      expect(scanResults(run)[0]?.summary, id).toBe(`${label}: pieprasījumu limits`);
    }
  });

  it("pārāk lielu stat.vin lapu apgriež, bet __NEXT_DATA__ ar izsoles datiem saglabā", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-browser-fetch", { vin: VIN, at: "t1", ids: ["stat_vin", "bid_cars"] });
    const next = `<script id="__NEXT_DATA__" type="application/json">{"vin":"${VIN}"}</script>`;
    const big = `<html><body>${VIN} ${"x".repeat(1_000_000)}${next}</body></html>`;
    run.gm.xhr[0]!.onload!({ status: 200, responseText: big });
    run.gm.xhr[1]!.onload!({ status: 200, responseText: big });
    const [stat, bid] = scanResults(run);
    expect(stat!.html!.length).toBeLessThanOrEqual(900_000);
    expect(stat!.html).toContain(next);
    expect(bid!.html!.length).toBeLessThanOrEqual(900_000);
  });
});

describe("userscript admin lapā: skenēšanas rinda", () => {
  it("katram pārlūka avotam atver to pašu URL, ko katalogs", () => {
    const vin = VIN;
    expect(VIN_SCAN_BROWSER_CATALOG.length).toBeGreaterThan(10);
    for (const item of VIN_SCAN_BROWSER_CATALOG) {
      expect(scanQueueUrl(item.id), item.id).toBe(item.openUrl(vin));
    }
    expect(VIN_SCAN_SOURCE_IDS).toHaveLength(39);
    expect(VIN_SCAN_SOURCE_IDS).toContain("joj_copart_iaai");
    expect(VIN_SCAN_SOURCE_IDS).toContain("thecarapi_eu");
    expect(VIN_SCAN_BROWSER_IDS).not.toContain("joj_copart_iaai");
    expect(VIN_SCAN_BROWSER_IDS).not.toContain("thecarapi_eu");
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
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).toContain("plc_auction");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("vp_wanted");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).toContain("lt_itpr");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("autodna_preview");
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("vininspect");
    for (const removed of VIN_SCAN_REMOVED_IDS) {
      expect(VIN_SCAN_SOURCE_IDS).not.toContain(removed);
      expect(scanQueueUrl(removed), removed).toBe("");
    }
  });

  it("VW grupas atsaukumiem atver GOV.UK pārbaudi, nevis ražotāja lapu", () => {
    expect(scanQueueUrl("recall_vw")).toBe(vwGroupRecallCheckUrl(VIN));
    expect(new URL(scanQueueUrl("recall_vw")).hostname).toBe("www.gov.uk");
  });

  it("rindā saglabā VIN un avotus, lai avota cilne zina, ko pārbaudīt", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-vin-scan-browser", { vin: "wba5r1c0-xlfh42873", sources: ["plc_auction", "lt_itpr"] });
    expect(run.gm.set.get("provin_pending_vin")).toBe(VIN);
    expect(JSON.parse(String(run.gm.set.get("provin_scan_job")))).toMatchObject({
      vin: VIN,
      sources: ["plc_auction", "lt_itpr"],
      index: 0,
    });
  });

  it("avota atbildi nodod adminam un pēc pēdējā avota rindu notīra", () => {
    const run = runUserscriptAt(ADMIN);
    run.fire("provin-vin-scan-browser", { vin: VIN, sources: ["plc_auction"] });
    run.gm.set.set("provin_scan_result", JSON.stringify({ id: "plc_auction", vin: VIN, status: "none", summary: "Nav ierakstu" }));
    run.tickIntervals();
    expect(scanResults(run)).toEqual([{ id: "plc_auction", vin: VIN, status: "none", summary: "Nav ierakstu" }]);
    expect(run.gm.set.has("provin_scan_job")).toBe(false);
    expect(run.opened).toHaveLength(0);
  });

  it("kataloga URL un SCAN_URLS ved uz tiem pašiem hostiem", () => {
    const vin = VIN;
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "checkcar_vin")?.openUrl(vin)).toBe(
      `https://checkcar.vin/report/check/${vin}`,
    );
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "plc_auction")?.openUrl(vin)).toBe(
      `https://plc.auction/?vin=${vin}`,
    );
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "lt_itpr")?.openUrl(vin)).toBe(
      `https://www.epolicija.lt/eservice/wanted-vehicles-search?vin=${vin}`,
    );
  });
});

describe("userscript avota lapā skenēšanas laikā", () => {
  it("plc.auction: nav ierakstu - atdod statusu un lapas HTML arhīva importam", () => {
    const href = vinScanCatalogItem("plc_auction").openUrl(VIN);
    const pageHtml = "<html><body><p>Sorry, could not find what you were looking for</p></body></html>";
    const { result } = probeSourcePage("plc_auction", href, "Sorry, could not find what you were looking for", pageHtml);
    expect(result).toMatchObject({ id: "plc_auction", vin: VIN, status: "none", summary: "Nav ierakstu", html: pageHtml, pageUrl: href });
  });

  it("epolicija.lt: auto nav meklēšanā", () => {
    const { result } = probeSourcePage("lt_itpr", vinScanCatalogItem("lt_itpr").openUrl(VIN), "Paieška. Duomenų nerasta");
    expect(result).toMatchObject({ id: "lt_itpr", status: "none", summary: "Nav meklēšanā" });
    expect(result?.html).toBeTruthy();
  });

  it("stat.vin: atrod izsoles ierakstu ar izsoļu namu un lota numuru", () => {
    const text = `2019 BMW 530 VIN ${VIN} Copart Lot number: 50558298 Sold Odometer 185389`;
    const { result } = probeSourcePage("stat_vin", vinScanCatalogItem("stat_vin").openUrl(VIN), text);
    expect(result).toMatchObject({ id: "stat_vin", status: "found" });
    expect(result?.summary).toContain("Copart");
    expect(result?.auctions?.[0]).toMatchObject({ venue: "Copart", title: "Copart · lots 50558298" });
  });

  it("stat.vin: pieprasījumu limits netiek uzrādīts kā 'nav ieraksta'", () => {
    const { result } = probeSourcePage("stat_vin", vinScanCatalogItem("stat_vin").openUrl(VIN), "Too many requests. Try again later");
    expect(result).toMatchObject({ status: "unknown", summary: "stat.vin: pieprasījumu limits" });
  });

  it("GOV.UK atsaukumi: tikai pārlūkā, bez automātiskas nolasīšanas", () => {
    const { result } = probeSourcePage("recall_vw", vwGroupRecallCheckUrl(VIN), "Check if a vehicle has been recalled");
    expect(result).toMatchObject({
      id: "recall_vw",
      status: "browser_only",
      summary: "Lielbritānijas GOV.UK atsaukumu pārbaude pārlūkā",
    });
    expect(result?.html).toBeUndefined();
  });

  it("checkcar.vin: no sākumlapas pāriet uz atskaites lapu ar VIN", () => {
    const { run } = probeSourcePage("checkcar_vin", "https://checkcar.vin/", "checkcar");
    expect(run.assigned).toEqual([vinScanCatalogItem("checkcar_vin").openUrl(VIN)]);
  });

  it("Cloudflare lapa netiek klasificēta kā rezultāts", () => {
    const { result } = probeSourcePage("bid_cars", vinScanCatalogItem("bid_cars").openUrl(VIN), "Just a moment... no results");
    expect(result).toBeNull();
    const clean = probeSourcePage("bid_cars", vinScanCatalogItem("bid_cars").openUrl(VIN), "Search: no results");
    expect(clean.result).toMatchObject({ id: "bid_cars", status: "none" });
  });
});

describe("Zviedrijas reģistra imports: avota cilne -> pasūtījuma lapa", () => {
  const pageHtml = `<html><body><h1>Volvo V60</h1><p>Fabrikat Volvo. Chassinummer ${VIN}</p></body></html>`;

  it.each([
    ["biluppgifter", "https://biluppgifter.se/fordon/abc123"],
    ["transportstyrelsen", "https://fu-regnr.transportstyrelsen.se/extweb/UppgifterAnnatFordon"],
    ["carinfo", `https://www.car.info/en-se/vin/S/${VIN}`],
  ])("%s lapa tiek nosūtīta un pasūtījuma lapā nonāk kā rezultāts ar pasūtījuma VIN", (id, href) => {
    const source = runUserscriptAt(href, { bodyText: `Fabrikat Volvo Chassinummer ${VIN}`, pageHtml });
    source.tickIntervals();
    expect(source.created.some((el) => el.textContent === "Zviedrijas dati nosūtīti uz PROVIN")).toBe(true);

    const marker = new FakeElement("span", { attrs: { "data-provin-order-vin": VIN } });
    const admin = runUserscriptAt(ADMIN_ORDER, { gm: Object.fromEntries(source.gm.set), elements: [marker] });
    admin.tickIntervals();
    expect(scanResults(admin)).toEqual([expect.objectContaining({ id, vin: VIN, status: "found", html: pageHtml, pageUrl: href })]);
    expect(admin.gm.set.has("provin_se_import")).toBe(false);
  });

  it("BankID / Cloudflare lapu bez auto datiem nesūta", () => {
    const source = runUserscriptAt("https://biluppgifter.se/fordon/abc123", { bodyText: "Logga in med BankID", pageHtml });
    source.tickIntervals();
    expect(source.gm.set.has("provin_se_import")).toBe(false);
  });

  it("bez pasūtījuma VIN marķiera admin lapa importu neizmanto", () => {
    const source = runUserscriptAt("https://biluppgifter.se/fordon/abc123", { bodyText: "Fabrikat Volvo", pageHtml });
    source.tickIntervals();
    const admin = runUserscriptAt(ADMIN_ORDER, { gm: Object.fromEntries(source.gm.set) });
    admin.tickIntervals();
    expect(scanResults(admin)).toHaveLength(0);
  });
});

describe("minimālā paneļa versija", () => {
  it("minimālā paneļa versija ir 1.26 (admin tilta drošības labojums)", () => {
    expect(vinScanUserscriptMinLabel()).toBe("1.26");
    expect(VIN_SCAN_USERSCRIPT_MIN).toEqual({ major: 1, minor: 26 });
    expect(vinScanUserscriptMeetsMin("1.25.0")).toBe(false);
    expect(vinScanUserscriptMeetsMin("1.26.0")).toBe(true);
    expect(vinScanUserscriptMeetsMin("1.26.1")).toBe(true);
    expect(vinScanUserscriptMeetsMin("1.26")).toBe(true);
    expect(vinScanUserscriptMeetsMin("1.27.1")).toBe(true);
    expect(vinScanUserscriptMeetsMin("2.0.0")).toBe(true);
    expect(vinScanUserscriptUpdateNeeded("")).toBe(false);
    expect(vinScanUserscriptUpdateNeeded("1.24.2")).toBe(true);
    expect(vinScanUserscriptUpdateNeeded("1.25.0")).toBe(true);
    expect(vinScanUserscriptUpdateNeeded("1.26.0")).toBe(false);
    expect(vinScanUserscriptUpdateNeeded("1.26.1")).toBe(false);
  });

  it("importa kļūda 'lapa nav gatava' operatoram ir saprotama", () => {
    expect(browserImportErrorLv("page_not_ready")).toContain("Lapa vēl nav gatava");
  });
});
