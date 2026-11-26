import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  buildQuickEvalRecommendations,
  buildQuickEvalRedFlags,
  dealerCoverageForMake,
  isQuickEvalScanFresh,
  parseQuickEvalAutoStatus,
  quickEvalAutoLockKey,
  quickEvalAutoView,
  quickEvalPeekIdFromRelayRef,
  quickEvalProductPriceLabel,
  quickEvalRelayRef,
  quickEvalScanCacheUsable,
  QUICK_EVAL_SOURCE_NAME_RE,
  type QuickEvalRecommendationInput,
} from "@/lib/quick-eval-auto-core";
import type { SourceIssue } from "@/lib/source-consistency";
import { buildVinScanIndicator } from "@/lib/vin-scan/types";

const VIN = "WBA5R1C0XLFH42873";
const NOW = Date.parse("2026-11-26T12:00:00Z");
const AT = "2026-11-26T11:00:00.000Z";

const AUTODNA_DETAIL = [
  "Kopā: 83",
  "Transportlīdzekļa vēsture: ir · 16",
  "Auto arhīva fotogrāfijas: ir · 67",
].join("\n");

function blocks(csdd: Record<string, unknown> = {}) {
  const b = mergeSourceBlocksWithDefaults(null);
  return { ...b, csdd: { ...b.csdd, ...csdd } };
}

function input(over: Partial<QuickEvalRecommendationInput> = {}): QuickEvalRecommendationInput {
  return { vin: VIN, indicators: [], issues: [], banners: [], blocks: blocks(), auctionSales: 0, nowMs: NOW, ...over };
}

const mileageIssue: SourceIssue = {
  id: "mileage_drop_1",
  kind: "mileage_drop",
  severity: "critical",
  title: "Nobraukums samazinājies, −12 000 km",
  values: [{ source: "CSDD", value: "150 000 km" }],
};

describe("ātro vērtējumu automātika - ieteikumi", () => {
  it("bez fakta neiesaka neko", () => {
    expect(buildQuickEvalRecommendations(input())).toEqual([]);
  });

  it("vēstures ieraksti un foto no priekšskata - tikai datu tips un skaits", () => {
    const row = { ...buildVinScanIndicator("autodna_precheck", VIN, { status: "found", summary: "AutoDNA: 83", detail: AUTODNA_DETAIL }), scannedAt: AT };
    const recs = buildQuickEvalRecommendations(input({ indicators: [row] }));
    expect(recs).toEqual([{ id: "autodna", text: "Pieejama papildu vēsture: 16 ieraksti, 67 arhīva fotogrāfijas", product: "audits" }]);
  });

  it("priekšpārbaudē 0 ierakstu un 0 foto - neiesaka (Nila likums 25.11)", () => {
    const detail = ["Kopā: 10", "Transportlīdzekļa vēsture: nav · 0", "Auto arhīva fotogrāfijas: nav · 0"].join("\n");
    const row = { ...buildVinScanIndicator("autodna_precheck", VIN, { status: "found", summary: "x", detail }), scannedAt: AT };
    expect(buildQuickEvalRecommendations(input({ indicators: [row] }))).toEqual([]);
  });

  it("ārvalstu ieraksti ar valstīm, nobraukumu un apskatēm", () => {
    const row = buildVinScanIndicator("carfax_eu", VIN, {
      status: "found",
      summary: "5 ieraksti",
      detail: ["Valstis: NL 5", "Nobraukuma rādījumi: 3", "Tehniskās apskates: 2"].join("\n"),
    });
    const [r] = buildQuickEvalRecommendations(input({ indicators: [row] }));
    expect(r).toEqual({ id: "carfax", text: "Vēstures ieraksti no ārvalstīm (NL): 3 nobraukuma ieraksti, 2 tehniskās apskates", product: "audits" });
  });

  it("nobraukuma pretruna LV auto - oficiālā reģistra izziņa", () => {
    const recs = buildQuickEvalRecommendations(input({ issues: [mileageIssue], blocks: blocks({ registrationNumber: "AB1234" }) }));
    expect(recs.map((r) => r.text)).toEqual(["Nobraukuma pretrunu var precizēt ar oficiālo reģistra izziņu"]);
  });

  it("e.csdd nav ielasīts un CSDD nav rādījumu - izziņa; e.csdd ielasīts - nē", () => {
    const b = blocks({ registrationNumber: "AB1234" });
    expect(buildQuickEvalRecommendations(input({ blocks: b, ecsddState: "smartid_wait" })).map((r) => r.id)).toEqual(["csdd_sms"]);
    expect(buildQuickEvalRecommendations(input({ blocks: b, ecsddState: "ok" }))).toEqual([]);
  });

  it("bez LV numura reģistra izziņu neiesaka", () => {
    expect(buildQuickEvalRecommendations(input({ issues: [mileageIssue] }))).toEqual([]);
  });

  it("izsoles un vairākas valstis", () => {
    expect(buildQuickEvalRecommendations(input({ auctionSales: 2 }))[0]?.text).toBe("Izsoļu vēsture: 2 ieraksti");
    const se = buildVinScanIndicator("carinfo", VIN, { status: "found", summary: "x", flags: { registrationCountry: "SE" } });
    const dk = buildVinScanIndicator("tjekbil", VIN, { status: "found", summary: "x", flags: { registrationCountry: "DK" } });
    const recs = buildQuickEvalRecommendations(input({ indicators: [se, dk] }));
    expect(recs.find((r) => r.id === "carvertical")?.text).toBe("Vēsture vairākās valstīs (DK, SE)");
  });

  it("dīlera dati atbalstītai markai", () => {
    expect(dealerCoverageForMake("MERCEDES BENZ E 220")?.brand).toBe("Mercedes-Benz");
    expect(dealerCoverageForMake("Skoda Octavia")?.brand).toBe("Škoda");
    expect(dealerCoverageForMake("CITROEN C5")?.tier).toBe("workshop");
    expect(dealerCoverageForMake("SUBARU Forester")).toBeNull();
    expect(dealerCoverageForMake("")).toBeNull();
    const recs = buildQuickEvalRecommendations(input({ blocks: blocks({ makeModel: "BMW 530D" }) }));
    expect(recs).toEqual([{ id: "dealer", text: "Servisa vēsture no ražotāja", product: "dealer" }]);
  });

  it("nevienā tekstā nav avotu nosaukumu; cena tikai mūsu produktam", () => {
    const rows = [
      { ...buildVinScanIndicator("autodna_precheck", VIN, { status: "found", summary: "x", detail: AUTODNA_DETAIL }), scannedAt: AT },
      buildVinScanIndicator("carfax_eu", VIN, { status: "found", summary: "8 ieraksti", detail: "Valstis: DE 4, SE 4" }),
    ];
    const recs = buildQuickEvalRecommendations(
      input({ indicators: rows, issues: [mileageIssue], auctionSales: 1, blocks: blocks({ registrationNumber: "AB1234", makeModel: "Audi A4" }) }),
    );
    expect(recs.length).toBe(5);
    for (const r of recs) {
      expect(r.text).not.toMatch(QUICK_EVAL_SOURCE_NAME_RE);
      expect(r.text).not.toMatch(/€/);
    }
    expect(quickEvalProductPriceLabel("audits")).toBe("PROVIN AUDITS 99,99 €");
    expect(quickEvalProductPriceLabel("dealer")).toBe("Dīlera dati 24,99 €");
  });
});

describe("sarkanie karogi", () => {
  it("zagts, pretrunas pēc nopietnības, info bez vinjetes", () => {
    const stolen = buildVinScanIndicator("rdw", VIN, { status: "found", summary: "x", flags: { stolen: true } });
    const flags = buildQuickEvalRedFlags({
      issues: [{ ...mileageIssue, severity: "warn" }, { ...mileageIssue, id: "i", severity: "info", title: "info" }],
      banners: [
        { kind: "vignette", text: "vinjete", severity: "yellow" },
        { kind: "odometer", text: "Odometrs", severity: "red" },
      ],
      indicators: [stolen],
    });
    expect(flags.map((f) => f.severity)).toEqual(["red", "red", "yellow"]);
    expect(flags[0]!.text).toMatch(/zagts/);
    expect(flags.some((f) => f.text === "vinjete")).toBe(false);
    expect(flags.some((f) => f.text.startsWith("info"))).toBe(false);
  });
});

describe("slēdzene, kešs, statuss", () => {
  it("slēdzenes atslēga: pieteikums + VIN, atkārtojumam savs spainis", () => {
    expect(quickEvalAutoLockKey("abc-1", "wba1")).toBe("qe-auto_abc-1_WBA1");
    expect(quickEvalAutoLockKey("abc-1", "wba1", "5")).toBe("qe-auto_abc-1_WBA1_r5");
  });

  it("kešs: < 24 h un visi avoti", () => {
    expect(isQuickEvalScanFresh(AT, NOW)).toBe(true);
    expect(isQuickEvalScanFresh("2026-11-25T11:00:00Z", NOW)).toBe(false);
    const snap = { scannedAt: AT, indicators: [{ id: "csdd" }, { id: "tjekbil" }] };
    expect(quickEvalScanCacheUsable(snap, ["csdd", "tjekbil"], NOW)).toBe(true);
    expect(quickEvalScanCacheUsable(snap, ["csdd", "tjekbil", "carfax_eu"], NOW)).toBe(false);
    expect(quickEvalScanCacheUsable(null, ["csdd"], NOW)).toBe(false);
  });

  it("iestrēdzis «running» = kļūda", () => {
    const st = { state: "running" as const, key: "x", startedAt: "2026-11-26T11:00:00Z", steps: {}, flags: [], recommendations: [] };
    expect(quickEvalAutoView(st, Date.parse("2026-11-26T11:05:00Z"))).toBe("running");
    expect(quickEvalAutoView(st, Date.parse("2026-11-26T11:30:00Z"))).toBe("error");
    expect(quickEvalAutoView(null, NOW)).toBe("none");
  });

  it("releja ref turp un atpakaļ; pasūtījums nav ātrais vērtējums", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const ref = quickEvalRelayRef(id);
    expect(ref).toMatch(/^[A-Za-z0-9_]+$/);
    expect(quickEvalPeekIdFromRelayRef(ref)).toBe(id);
    expect(quickEvalPeekIdFromRelayRef("cs_live_abc123")).toBeNull();
  });

  it("statusa parsēšana atmet nederīgo", () => {
    expect(parseQuickEvalAutoStatus({ state: "x" })).toBeNull();
    const p = parseQuickEvalAutoStatus({
      state: "ready",
      key: "AB1234",
      startedAt: AT,
      steps: { vin_scan: { state: "ok", note: "No keša" }, bogus: { state: "ok" } },
      recommendations: [{ id: "dealer", text: "Servisa vēsture no ražotāja", product: "dealer" }, { id: "nav", text: "x" }],
      flags: [{ severity: "red", text: "a" }, { severity: "blue", text: "b" }],
    });
    expect(Object.keys(p!.steps)).toEqual(["vin_scan"]);
    expect(p!.recommendations).toHaveLength(1);
    expect(p!.flags).toHaveLength(1);
  });
});
