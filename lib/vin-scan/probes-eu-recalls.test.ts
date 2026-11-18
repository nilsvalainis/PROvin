import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scanFetch = vi.fn();
vi.mock("@/lib/vin-scan/http", () => ({
  scanFetch: (...args: unknown[]) => scanFetch(...args),
  scanFetchSmart: vi.fn(),
  scanChallengeReason: vi.fn(() => ""),
}));

import { vinScanCatalogItem } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds, isFreeVinScanSourceId } from "@/lib/vin-scan/free-sources";
import {
  buildSafetyGateResult,
  parseSafetyGateDetail,
  parseSafetyGateSearch,
  safetyGateSearchTerm,
  safetyGateYearRange,
  selectSafetyGateAlerts,
  type SafetyGateDetail,
  type SafetyGateSearch,
} from "@/lib/vin-scan/parse-eu-safety-gate";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { vinScanProbeFor } from "@/lib/vin-scan/probes";
import { probeEuSafetyGate } from "@/lib/vin-scan/probes-eu-recalls";
import { vinScanRowTtlMs } from "@/lib/vin-scan/source-ttl";
import { buildVinScanFacts } from "@/lib/vin-scan/summary";
import { buildVinScanIndicator } from "@/lib/vin-scan/types";

function fixture(name: string): { status: number; text: string } {
  const raw = JSON.parse(readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/eu-safety-gate", name), "utf8")) as {
    _meta: { status: number };
    body: unknown;
  };
  return { status: raw._meta.status, text: JSON.stringify(raw.body) };
}

function search(name: string): Extract<SafetyGateSearch, { ok: true }> {
  const { status, text } = fixture(name);
  const parsed = parseSafetyGateSearch(status, text);
  if (!parsed.ok) throw new Error(parsed.summary);
  return parsed;
}

function detail(): SafetyGateDetail {
  const { status, text } = fixture("detail-10119264-lv.json");
  const parsed = parseSafetyGateDetail(status, text);
  if (!parsed) throw new Error("detail fixture");
  return parsed;
}

const NOW = 2026;
const SKODA_VIN = "TMBJH9NP9N7043581";
const VW_VIN = "WVWZZZ7NZEV015204";
const ctx = (vin: string) => ({ vin, plates: emptyVinScanPlates(), listingUrl: "" });

type Reply = { status: number; text: string } | Error;

/** Maršrutē pēc URL: vPIC dekodēšana, Safety Gate meklēšana, Safety Gate detaļas. */
function route(replies: { vpic?: Reply; search?: Reply; detail?: Reply }) {
  scanFetch.mockImplementation(async (url: string) => {
    const reply = url.includes("vpic.nhtsa.dot.gov")
      ? (replies.vpic ?? { status: 500, text: "" })
      : url.endsWith("/public/api/search")
        ? (replies.search ?? { status: 500, text: "" })
        : (replies.detail ?? { status: 404, text: "" });
    if (reply instanceof Error) throw reply;
    return { ...reply, cookie: "" };
  });
}

const vpic = (make: string, model: string, year = ""): Reply => ({
  status: 200,
  text: JSON.stringify({ Results: [{ Make: make, Model: model, ModelYear: year }] }),
});

const searchCalls = () => scanFetch.mock.calls.filter(([url]) => String(url).endsWith("/public/api/search"));
const detailCalls = () => scanFetch.mock.calls.filter(([url]) => String(url).includes("/public/api/notification/"));

beforeEach(() => {
  scanFetch.mockReset();
});

describe("ES Safety Gate parseris", () => {
  it("meklēšanas atbilde: marka, modeļi, datums, numurs un riska veids", () => {
    const parsed = search("search-skoda.json");
    expect(parsed.total).toBe(13);
    expect(parsed.truncated).toBe(false);
    expect(parsed.alerts[0]).toEqual({
      id: 10119544,
      reference: "SR/03168/26",
      date: "2026-11-05",
      productName: "Passenger car",
      models: "Octavia III, Superb III, Karoq, Kodiaq I",
      brands: ["Skoda"],
      riskTypes: ["INJURIES"],
    });
  });

  it("bez modeļa: markas līmeņa brīdinājumi, 8 jaunākie, ar saiti un piezīmi par modeļa līmeni", () => {
    const parsed = buildSafetyGateResult({ make: "Škoda", model: "", year: "", search: search("search-skoda.json"), nowYear: NOW });
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toBe(
      "ES Safety Gate: 8 markas līmeņa brīdinājumi - Škoda, modelis nav zināms (var neattiekties uz šo auto, rādīti 8 jaunākie no 13)",
    );
    const lines = (parsed.detail ?? "").split("\n");
    expect(lines[0]).toContain("var neattiekties uz šo auto");
    expect(lines).toHaveLength(9);
    expect(lines[1]).toBe(
      "2026-11-05 · SR/03168/26 · Octavia III, Superb III, Karoq, Kodiaq I · traumu risks · https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/10119544?lang=lv",
    );
    expect(parsed.recalls).toHaveLength(8);
    expect(parsed.recalls?.[0]).toEqual({ title: "SR/03168/26, Octavia III, Superb III, Karoq, Kodiaq I, traumu risks", date: "2026-11-05" });
  });

  it("modeļa filtrs: paliek tikai brīdinājumi, kas nosauc šo modeli", () => {
    const parsed = buildSafetyGateResult({ make: "Škoda", model: "Kodiaq", year: "", search: search("search-skoda.json"), nowYear: NOW });
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toBe("ES Safety Gate: 6 modeļa līmeņa brīdinājumi - Škoda Kodiaq (var neattiekties uz šo auto)");
    const lines = (parsed.detail ?? "").split("\n").slice(1);
    expect(lines).toHaveLength(6);
    for (const line of lines) expect(line.toLowerCase()).toContain("kodiaq");
    // Jumta kaste un "Fabia" brīdinājumi nav Kodiaq.
    expect(parsed.detail).not.toContain("Roof Box");
    expect(parsed.detail).not.toContain("SR/02896/25");
  });

  it("modelis jānosauc kā vesels vārds, reģistrs un defises nav svarīgas", () => {
    const { alerts } = search("search-skoda.json");
    expect(selectSafetyGateAlerts(alerts, { make: "SKODA", model: "octavia" }).candidates).toHaveLength(8);
    expect(selectSafetyGateAlerts(alerts, { make: "Skoda", model: "Octa" }).candidates).toHaveLength(0);
    expect(selectSafetyGateAlerts(alerts, { make: "Skoda", model: "Enyaq" }).candidates).toHaveLength(0);
  });

  it("modelim nav brīdinājumu: none, bet pasaka, cik ir markai", () => {
    const parsed = buildSafetyGateResult({ make: "Škoda", model: "Enyaq", year: "2022", search: search("search-skoda.json"), nowYear: NOW });
    expect(parsed.status).toBe("none");
    expect(parsed.summary).toBe("ES Safety Gate: modelim Enyaq brīdinājumu nav (markai Škoda: 13, pēdējie 5 gadi)");
    expect(parsed.recalls).toBeUndefined();
  });

  it("cita marka netiek pieskaitīta: Škoda rezultāti Volvo auto dod none", () => {
    const skoda = search("search-skoda.json");
    expect(selectSafetyGateAlerts(skoda.alerts, { make: "Volvo", model: "" }).brandCount).toBe(0);
    const parsed = buildSafetyGateResult({ make: "Volvo", model: "", year: "", search: skoda, nowYear: NOW });
    expect(parsed.status).toBe("none");
    expect(parsed.summary).toBe("ES Safety Gate: brīdinājumu nav (Volvo, pēdējie 5 gadi)");
  });

  it("markas rakstības: VW un Volkswagen (VW) ir Volkswagen, Mercedes ir Mercedes-Benz, bet ne Mercedes-Benz LKW", () => {
    const vw = search("search-volkswagen.json");
    expect(selectSafetyGateAlerts(vw.alerts, { make: "VW", model: "" }).brandCount).toBe(8);
    expect(selectSafetyGateAlerts(vw.alerts, { make: "volkswagen", model: "" }).brandCount).toBe(8);
    expect(selectSafetyGateAlerts(vw.alerts, { make: "Audi", model: "" }).brandCount).toBe(0);
    const row = (brand: string) => ({ ...vw.alerts[0]!, brands: [brand] });
    const mb = [row("Mercedes-Benz"), row("Mercedes-Benz, Mercedes-AMG"), row("Mercedes-Benz LKW"), row("Mercedes")];
    expect(selectSafetyGateAlerts(mb, { make: "Mercedes-Benz", model: "" }).brandCount).toBe(3);
    expect(selectSafetyGateAlerts(mb, { make: "Mercedes", model: "" }).brandCount).toBe(3);
    expect(safetyGateSearchTerm("Škoda")).toBe("Skoda");
    expect(safetyGateSearchTerm("VW")).toBe("Volkswagen");
    expect(safetyGateSearchTerm("Mercedes")).toBe("Mercedes-Benz");
  });

  it("apgriezta lapa bez markas atbilstības nav none: MINI pilnteksts atrod 610 citus produktus", () => {
    const mini = search("search-mini-truncated.json");
    expect(mini.truncated).toBe(true);
    const parsed = buildSafetyGateResult({ make: "MINI", model: "", year: "", search: mini, nowYear: NOW });
    expect(parsed.status).toBe("unknown");
    expect(parsed.summary).toBe("ES Safety Gate: MINI nav starp 6 jaunākajiem no 610 rezultātiem, pārbaudi saitē");
  });

  it("detaļas: latviskais riska apraksts, ražošanas datumi un kategorija", () => {
    expect(detail()).toEqual({
      category: "product.category.motor.vehicles",
      productName: "Vieglais automobilis",
      riskText:
        "Mitruma iekļūšana var izraisīt stūres statņa skrūves koroziju, kas var izraisīt skrūves lūzumu un stūres spējas zudumu, palielinot negadījumu risku.",
      production: "04.09.2013 - 01.07.2024",
      yearFrom: 2013,
      yearTo: 2024,
    });
    expect(safetyGateYearRange("2019-03-01 - 2021-11-30")).toEqual({ from: 2019, to: 2021 });
    expect(safetyGateYearRange("05/2018 - 02/2020")).toEqual({ from: 2018, to: 2020 });
    expect(safetyGateYearRange("2016 - 2019")).toEqual({ from: 2016, to: 2019 });
    expect(safetyGateYearRange("48VS, partija 20231")).toBeNull();
    expect(parseSafetyGateDetail(500, "")).toBeNull();
    expect(parseSafetyGateDetail(200, "<html>")).toBeNull();
  });

  it("gada filtrs: ražošanas diapazonā paliek, ārpus tā tiek izlaists", () => {
    const vw = search("search-volkswagen.json");
    const details = new Map([[10119264, detail()]]);
    const inRange = buildSafetyGateResult({ make: "Volkswagen", model: "Touran", year: "2019", search: vw, details, nowYear: NOW });
    expect(inRange.status).toBe("found");
    expect(inRange.summary).toBe("ES Safety Gate: 1 modeļa līmeņa brīdinājums - Volkswagen Touran (var neattiekties uz šo auto)");
    expect(inRange.detail).toContain("SR/02935/26");
    expect(inRange.detail).toContain("Mitruma iekļūšana var izraisīt stūres statņa skrūves koroziju");
    expect(inRange.detail).toContain("ražots 04.09.2013 - 01.07.2024");

    const tooOld = buildSafetyGateResult({ make: "Volkswagen", model: "Touran", year: "2010", search: vw, details, nowYear: NOW });
    expect(tooOld.status).toBe("none");
    expect(tooOld.summary).toBe(
      "ES Safety Gate: 2010. gada Volkswagen Touran brīdinājumu nav (citiem ražošanas gadiem: 1, pēdējie 5 gadi)",
    );

    // Modeļa gads var atšķirties no ražošanas gada par 1; bez VIN gada nefiltrē.
    const edge = buildSafetyGateResult({ make: "Volkswagen", model: "Touran", year: "2025", search: vw, details, nowYear: NOW });
    expect(edge.status).toBe("found");
    const noYear = buildSafetyGateResult({ make: "Volkswagen", model: "Touran", year: "", search: vw, details, nowYear: NOW });
    expect(noYear.status).toBe("found");
  });

  it("detaļas ar citu produktu kategoriju (nav auto) netiek rādītas", () => {
    const vw = search("search-volkswagen.json");
    const toy = { ...detail(), category: "product.category.toys" };
    const parsed = buildSafetyGateResult({
      make: "Volkswagen",
      model: "Touran",
      year: "2019",
      search: vw,
      details: new Map([[10119264, toy]]),
      nowYear: NOW,
    });
    expect(parsed.status).toBe("none");
  });

  it("HTTP kļūda, ne-JSON un sveša forma nav none", () => {
    expect(parseSafetyGateSearch(500, "")).toEqual({ ok: false, summary: "ES Safety Gate: HTTP 500" });
    expect(parseSafetyGateSearch(405, "{}")).toEqual({ ok: false, summary: "ES Safety Gate: HTTP 405" });
    expect(parseSafetyGateSearch(200, "<html>").ok).toBe(false);
    expect(parseSafetyGateSearch(200, JSON.stringify({ error: "x" })).ok).toBe(false);
    const empty = parseSafetyGateSearch(200, JSON.stringify({ content: [], totalElements: 0, last: true }));
    expect(empty).toEqual({ ok: true, alerts: [], total: 0, truncated: false });
  });

  it("modeļa līmeņa skaits neiekļūst kopsavilkuma faktā Atsaukumi", () => {
    const parsed = buildSafetyGateResult({ make: "Škoda", model: "Kodiaq", year: "", search: search("search-skoda.json"), nowYear: NOW });
    expect(parsed.flags?.recallCount).toBeUndefined();
    const facts = buildVinScanFacts([buildVinScanIndicator("eu_safety_gate", SKODA_VIN, parsed)]);
    expect(facts.recalls).toEqual([]);
    expect(facts.registrations).toEqual([]);
  });
});

describe("ES Safety Gate zonde", () => {
  it("ir bezmaksas avots katalogā ar 7 dienu kešu", () => {
    expect(isFreeVinScanSourceId("eu_safety_gate")).toBe(true);
    expect(freeVinScanSourceIds()).toContain("eu_safety_gate");
    expect(vinScanProbeFor("eu_safety_gate")).toBe(probeEuSafetyGate);
    const item = vinScanCatalogItem("eu_safety_gate");
    expect(item.country).toBe("EU");
    expect(item.needs).toEqual(["vin"]);
    expect(item.openUrl(SKODA_VIN)).toBe("https://ec.europa.eu/safety-gate-alerts/screen/search?resetSearch=true");
    const day = 24 * 60 * 60 * 1000;
    expect(vinScanRowTtlMs("eu_safety_gate", "found")).toBe(7 * day);
    expect(vinScanRowTtlMs("eu_safety_gate", "none")).toBe(7 * day);
    expect(vinScanRowTtlMs("eu_safety_gate", "unknown")).toBe(0);
  });

  it("Škoda VIN bez vPIC modeļa: markas līmenis, meklē 'Skoda' pēdējos 5 gados", async () => {
    route({ search: fixture("search-skoda.json") });
    const row = await probeEuSafetyGate(ctx(SKODA_VIN));
    expect(row.status).toBe("found");
    expect(row.label).toBe("ES Safety Gate");
    expect(row.summary).toContain("8 markas līmeņa brīdinājumi - Škoda, modelis nav zināms");
    expect(row.flags?.recallCount).toBeUndefined();
    expect(row.vehicle).toBeUndefined();

    expect(searchCalls()).toHaveLength(1);
    const [url, init] = searchCalls()[0] as [string, { method: string; body: string; headers: Record<string, string> }];
    expect(url).toBe("https://ec.europa.eu/safety-gate-alerts/public/api/search");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body) as { fullTextSearch: string; criteria: { year: number[] }; pagination: { sortOrder: string } };
    expect(body.fullTextSearch).toBe("Skoda");
    const thisYear = new Date().getFullYear();
    expect(body.criteria.year).toEqual([thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4]);
    expect(body.pagination.sortOrder).toBe("DESC");
    // VIN nekad netiek sūtīts uz Safety Gate.
    for (const [calledUrl, calledInit] of [...searchCalls(), ...detailCalls()] as [string, { body?: string }][]) {
      expect(calledUrl).not.toContain(SKODA_VIN);
      expect(calledInit.body ?? "").not.toContain(SKODA_VIN);
    }
    // Detaļas prasa tikai rādītajiem 8 brīdinājumiem; to kļūda (404) rezultātu nebojā.
    expect(detailCalls()).toHaveLength(8);
  });

  it("vPIC modelis sašaurina līdz modelim, detaļas dod latvisku riska tekstu", async () => {
    route({ vpic: vpic("VOLKSWAGEN", "Touran", "2014"), search: fixture("search-volkswagen.json"), detail: fixture("detail-10119264-lv.json") });
    const row = await probeEuSafetyGate(ctx(VW_VIN));
    expect(row.status).toBe("found");
    expect(row.summary).toBe("ES Safety Gate: 1 modeļa līmeņa brīdinājums - Volkswagen Touran (var neattiekties uz šo auto)");
    expect(row.detail).toContain("Mitruma iekļūšana");
    expect(detailCalls()).toHaveLength(1);
    expect(String(detailCalls()[0]?.[0])).toBe("https://ec.europa.eu/safety-gate-alerts/public/api/notification/10119264?language=lv");
  });

  it("vPIC modelis citai markai netiek izmantots", async () => {
    route({ vpic: vpic("AUDI", "Touran"), search: fixture("search-volkswagen.json") });
    const row = await probeEuSafetyGate(ctx(VW_VIN));
    expect(row.status).toBe("found");
    expect(row.summary).toContain("markas līmeņa");
  });

  it("nav atbilstošu brīdinājumu: none", async () => {
    route({ vpic: vpic("SKODA", "Enyaq"), search: fixture("search-skoda.json") });
    const row = await probeEuSafetyGate(ctx(SKODA_VIN));
    expect(row.status).toBe("none");
    expect(row.summary).toContain("modelim Enyaq brīdinājumu nav");
    expect(detailCalls()).toHaveLength(0);
  });

  it("HTTP 500 ir unknown, nevis none", async () => {
    route({ search: { status: 500, text: "Internal Server Error" } });
    const row = await probeEuSafetyGate(ctx(SKODA_VIN));
    expect(row.status).toBe("unknown");
    expect(row.summary).toBe("ES Safety Gate: HTTP 500");
  });

  it("noildze ir timeout, tīkla kļūda ir unknown", async () => {
    route({ search: new Error("timeout") });
    const slow = await probeEuSafetyGate(ctx(SKODA_VIN));
    expect(slow.status).toBe("timeout");
    expect(slow.summary).toBe("Avots neatbildēja laikā");

    route({ search: new Error("ECONNRESET") });
    const broken = await probeEuSafetyGate(ctx(SKODA_VIN));
    expect(broken.status).toBe("unknown");
    expect(broken.summary).toBe("Avotu neizdevās nolasīt");
  });

  it("nezināma marka: skipped, Safety Gate netiek saukts", async () => {
    route({ vpic: { status: 200, text: JSON.stringify({ Results: [{ Make: "", Model: "" }] }) } });
    const row = await probeEuSafetyGate(ctx("00000000000000000"));
    expect(row.status).toBe("skipped");
    expect(row.summary).toBe("ES Safety Gate: marka no VIN nav nosakāma");
    expect(searchCalls()).toHaveLength(0);
  });

  it("marka tikai no vPIC (WMI nav sarakstā) arī der", async () => {
    route({ vpic: vpic("SKODA", "Kodiaq"), search: fixture("search-skoda.json") });
    const row = await probeEuSafetyGate(ctx("00000000000000000"));
    expect(row.status).toBe("found");
    expect(row.summary).toContain("6 modeļa līmeņa brīdinājumi - SKODA Kodiaq");
  });
});
