import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildDealerSignalsSectionHtml } from "@/lib/client-report-html";
import type { ClientReportPayload } from "@/lib/client-report-html";
import { CLIENT_REPORT_LANGS } from "@/lib/client-report-i18n";
import {
  addManualDealerSignal,
  DEALER_SIGNAL_DEFAULT_TEXTS,
  DEALER_SIGNAL_KINDS,
  DEALER_SIGNAL_TITLES,
  dealerSignalsAddableKinds,
  dealerSignalsPdfRows,
  isDealerSignalAlert,
  regenerateDealerSignals,
  removeDealerSignal,
  type DealerSignalsState,
} from "@/lib/dealer-signals";
import {
  detectDealerSignals,
  hasIncidentSignal,
  hasSpecialStatusSignal,
  hasUsHistorySignal,
  isMeaningfulDamageText,
} from "@/lib/dealer-signals-detect";
import { parseDealerSignals } from "@/lib/dealer-signals-persist";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

/**
 * «Signāli» no VISIEM pasūtījuma avotiem (Nils 27.11): ASV izsole ar bojājumu bez summas, salvage dokuments,
 * izsoļu foto tikai VIN SCAN / cc_vin RAW. Anonimizēta pasūtījuma forma (izdomāts VIN, bez numura, bez personas datiem).
 */
const VIN = "WBAXX0C50DD000000";

function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults(patch as unknown);
}

/** Pasūtījuma forma: cc_vin no VIN SCAN importa (bojājums bez summas, ASV nobraukums, foto tikai RAW saitēs). */
const US_ORDER_BLOCKS = {
  cc_vin: {
    mileage: [{ date: "04.11.2022", odometer: "205 093 km", country: "US" }],
    damages: [{ date: "04.11.2022", region: "IAAI", amount: "", description: "Front end + Unknown" }],
    insurance: [{ date: "", label: "", detail: "" }],
    brands: [{ date: "", label: "", detail: "" }],
    titles: [{ date: "", region: "", odometer: "", note: "" }],
    sales: [{ date: "04.11.2022", venue: "IAAI", odometer: "205 093 km", price: "", status: "2013 BMW 5 Series · Sold" }],
    rawUnprocessedData: `VIN SCAN izsoles foto:\nhttps://img.example.test/0-1/${VIN}-1.jpg\nhttps://img.example.test/0-1/${VIN}-2.jpg`,
    photos: [],
    photoGroups: [],
    thecarapiRecords: [],
  },
  ltab: { rows: [{ incidentNo: "", csngDate: "", lossAmount: "" }] },
};

const BID_CARS: VinScanIndicator = {
  id: "bid_cars",
  label: "bid.cars",
  country: "US",
  status: "found",
  summary: "1 izsole · 2022-11-04 · IAAI · 205 093 km · priekšpuse, nezināms · 10 foto",
  detail: [
    "Auto: 2013 BMW 5 Series",
    "Vieta: Atlanta (GA)",
    "Pārdevējs: Insurance",
    "Dokuments: Salvage (Georgia)",
    "Zaudējuma veids: Collision",
    "Bojājums: priekšpuse, nezināms",
  ].join("\n"),
  openUrl: null,
  auctions: [
    {
      title: "2013 BMW 5 Series · Sold",
      date: "2022-11-04",
      venue: "IAAI",
      lot: "0-1",
      odometer: "205 093 km",
      damage: "Front end + Unknown",
      photoUrl: `https://img.example.test/0-1/${VIN}-1.jpg`,
      photoCount: 10,
      photoUrls: [`https://img.example.test/0-1/${VIN}-1.jpg`],
    },
  ],
};

/** Modeļa līmeņa ASV dati un vecs NICB viltus trāpījums - nav šī auto vēsture. */
const MODEL_LEVEL_US: VinScanIndicator[] = [
  { id: "nhtsa_complaints", label: "NHTSA sūdzības", country: "US", status: "found", summary: "Tipiskās kaites: 39", detail: "", openUrl: null },
  { id: "nhtsa_recalls", label: "NHTSA atsaukumi", country: "US", status: "found", summary: "19", detail: "", openUrl: null, flags: { recallCount: 19 } },
  { id: "nicb", label: "NICB", country: "US", status: "found", summary: "NICB: iespējams zagts", detail: "", openUrl: null, flags: { stolen: true } },
  { id: "vin_decode", label: "WMI", country: "ISO", status: "found", summary: "Ražots: ASV", detail: "", openUrl: null, flags: { manufactureCountry: "US" } },
];

describe("signāli no visiem avotiem (ASV izsoles pasūtījuma forma)", () => {
  it("pasūtījums ar ASV izsoli: īpašs statuss, bojājumi, ASV vēsture, izsoļu foto", () => {
    const kinds = detectDealerSignals({ sourceBlocks: blocks(US_ORDER_BLOCKS), sourceIssues: [], vinScan: { indicators: [BID_CARS] } });
    expect(kinds).toEqual(["special_status", "incidents", "us_history", "auction_photos"]);
  });

  it("bez VIN SCAN (tikai bloki): bojājums bez summas, ASV, foto saites RAW - bez dokumenta statusa", () => {
    const kinds = detectDealerSignals({ sourceBlocks: blocks(US_ORDER_BLOCKS), sourceIssues: [] });
    expect(kinds).toEqual(["incidents", "us_history", "auction_photos"]);
  });

  it("tikai VIN SCAN (vēl nav importēts blokos) -> tie paši signāli", () => {
    const kinds = detectDealerSignals({ sourceBlocks: blocks({}), sourceIssues: [], vinScan: { indicators: [BID_CARS] } });
    expect(kinds).toEqual(["special_status", "incidents", "us_history", "auction_photos"]);
  });

  it("modeļa līmeņa ASV dati, ražotājvalsts ASV un NICB «iespējams zagts» -> nekas", () => {
    expect(detectDealerSignals({ sourceBlocks: blocks({}), sourceIssues: [], vinScan: { indicators: MODEL_LEVEL_US } })).toEqual([]);
  });

  it("VIN SCAN rinda, kas nav «found», netiek skaitīta", () => {
    const stale = { ...BID_CARS, status: "none" as const };
    expect(detectDealerSignals({ sourceBlocks: blocks({}), sourceIssues: [], vinScan: { indicators: [stale] } })).toEqual([]);
  });
});

describe("negadījumi un bojājumi", () => {
  it("bojājuma apraksts: faktiska daļa - jā; «Normal wear», «None», «Unknown» - nē", () => {
    expect(isMeaningfulDamageText("Front end + Unknown")).toBe(true);
    expect(isMeaningfulDamageText("Hail")).toBe(true);
    expect(isMeaningfulDamageText("Normal Wear")).toBe(false);
    expect(isMeaningfulDamageText("Unknown")).toBe(false);
    expect(isMeaningfulDamageText("None")).toBe(false);
    expect(isMeaningfulDamageText("")).toBe(false);
  });

  it("izsoles rinda «Normal wear» bez summas -> nav negadījuma", () => {
    const b = blocks({ cc_vin: { damages: [{ date: "01.01.2023", region: "IAAI", amount: "", description: "Normal Wear" }] } });
    expect(hasIncidentSignal(b)).toBe(false);
  });

  it("negadījums ar datumu, bet bez summas (AutoDNA forma) -> ir; tikai valsts -> nav", () => {
    const withDate = blocks({ autodna: { incidents: [{ incidentNo: "Vācija", csngDate: "08.2015", lossAmount: "" }] } });
    expect(hasIncidentSignal(withDate)).toBe(true);
    const onlyCountry = blocks({ autodna: { incidents: [{ incidentNo: "Vācija", csngDate: "", lossAmount: "" }] } });
    expect(hasIncidentSignal(onlyCountry)).toBe(false);
  });
});

describe("ASV vēsture", () => {
  it("Eiropas izsoles (BCA / Openlane, valsts EU) -> nav ASV", () => {
    const b = blocks({
      cc_vin: {
        mileage: [{ date: "20.10.2026", odometer: "193 320 km", country: "EU" }],
        sales: [{ date: "20.10.2026", venue: "BCA", odometer: "193 320 km", price: "", status: "BCA" }],
      },
    });
    expect(hasUsHistorySignal(b)).toBe(false);
  });

  it("valsts «ASV» / «USA» citu avotu rindās -> ir", () => {
    expect(hasUsHistorySignal(blocks({ autodna: { serviceHistory: [{ date: "05.2014", odometer: "40000", country: "ASV" }] } }))).toBe(true);
    expect(hasUsHistorySignal(blocks({ carvertical: { incidents: [{ incidentNo: "USA", csngDate: "05.2014", lossAmount: "" }] } }))).toBe(true);
  });

  it("CARFAX.eu valstu sadalījumā ASV -> ir; tikai DE -> nav", () => {
    const cf = (countries: string[]): VinScanIndicator => ({
      id: "carfax_eu",
      label: "CARFAX.eu",
      country: "EU",
      status: "found",
      summary: "",
      detail: "",
      openUrl: null,
      flags: { countries },
    });
    expect(hasUsHistorySignal(blocks({}), { vinScan: { indicators: [cf(["US", "DE"])] } })).toBe(true);
    expect(hasUsHistorySignal(blocks({}), { vinScan: { indicators: [cf(["DE"])] } })).toBe(false);
  });
});

describe("īpašs statuss", () => {
  it("tituls / zīmols «Rebuilt», «Flood» -> ir; «Clean», «Salvage: No» -> nav", () => {
    expect(hasSpecialStatusSignal(blocks({ cc_vin: { titles: [{ date: "2021", region: "TX", odometer: "", note: "Rebuilt" }] } }))).toBe(true);
    expect(hasSpecialStatusSignal(blocks({ cc_vin: { brands: [{ date: "2020", label: "Flood damage", detail: "" }] } }))).toBe(true);
    expect(hasSpecialStatusSignal(blocks({ cc_vin: { titles: [{ date: "2021", region: "TX", odometer: "", note: "Clean" }] } }))).toBe(false);
    expect(hasSpecialStatusSignal(blocks({ cc_vin: { brands: [{ date: "", label: "Salvage: No", detail: "" }] } }))).toBe(false);
  });

  it("VIN SCAN dokuments «Clean (Georgia)» -> nav; izsoļu nosaukums «salvage izsole» bez dokumenta -> nav", () => {
    const clean = { ...BID_CARS, detail: "Dokuments: Clean (Georgia)\nPārdevējs: Salvage auction" };
    expect(hasSpecialStatusSignal(blocks({}), { vinScan: { indicators: [clean] } })).toBe(false);
  });

  it("sarkanā rinda PDF kā nobraukuma nesakritība", () => {
    expect(isDealerSignalAlert("special_status")).toBe(true);
    expect(isDealerSignalAlert("mileage_mismatch")).toBe(true);
    expect(isDealerSignalAlert("us_history")).toBe(false);
    const rows = dealerSignalsPdfRows(
      { enabled: true, items: [{ kind: "special_status", checked: true }, { kind: "us_history", checked: true }] },
      "lv",
    );
    expect(rows.map((r) => [r.kind, r.alert])).toEqual([
      ["special_status", true],
      ["us_history", false],
    ]);
  });
});

describe("jaunie tipi - teksti", () => {
  it("visās valodās: virsraksts un teksts bez cipariem, avotu nosaukumiem un garās defises", () => {
    for (const kind of ["special_status", "us_history", "incidents"] as const) {
      for (const lang of CLIENT_REPORT_LANGS) {
        const t = `${DEALER_SIGNAL_TITLES[kind][lang]} ${DEALER_SIGNAL_DEFAULT_TEXTS[kind][lang]}`;
        expect(t).not.toMatch(/\d|[–—]|carfax|autocheck|iaai|copart|bid\.?cars|nicb|eksperts|pirkt/i);
        expect(t.trim().length).toBeGreaterThan(5);
      }
    }
  });

  it("PDF sadaļā (EN) ASV vēsture un īpašs statuss ar tulkotu tekstu", () => {
    const payload = {
      pdfReportKind: "dealer",
      dealerSignals: { enabled: true, items: [{ kind: "special_status", checked: true }, { kind: "us_history", checked: true }] },
      dealerSignalsAuditLink: { url: "https://www.provin.lv/en?plan=audits" },
    } as unknown as ClientReportPayload;
    const html = buildDealerSignalsSectionHtml(payload, "en");
    expect(html).toContain("US history");
    expect(html).toMatch(/history includes records from the USA/);
    expect(html).toMatch(/pdf-dealer-signal-row--alert" data-signal="special_status"/);
  });
});

describe("manuāli pievienoti signāli", () => {
  const base: DealerSignalsState = { enabled: false, items: [{ kind: "incidents", checked: true }] };

  it("pievieno ar ķeksi un atzīmi «manual»; kanoniskā secībā; slēdzis netiek mainīts", () => {
    const next = addManualDealerSignal(base, "mileage_mismatch");
    expect(next.enabled).toBe(false);
    expect(next.items).toEqual([
      { kind: "mileage_mismatch", checked: true, manual: true },
      { kind: "incidents", checked: true },
    ]);
  });

  it("viens ieraksts uz tipu: esošs tips (automātisks vai manuāls) netiek dublēts un nav izvēlnē", () => {
    expect(addManualDealerSignal(base, "incidents")).toBe(base);
    const once = addManualDealerSignal(base, "us_history");
    expect(addManualDealerSignal(once, "us_history")).toBe(once);
    expect(dealerSignalsAddableKinds(once)).toEqual(DEALER_SIGNAL_KINDS.filter((k) => k !== "incidents" && k !== "us_history"));
    expect(dealerSignalsAddableKinds(undefined)).toEqual([...DEALER_SIGNAL_KINDS]);
  });

  it("no tukša (vēl nesaglabāta) stāvokļa", () => {
    expect(addManualDealerSignal(undefined, "auction_photos")).toEqual({
      enabled: false,
      items: [{ kind: "auction_photos", checked: true, manual: true }],
    });
  });

  it("«Pārģenerēt no datiem» manuālos neizdzēš (arī ar atiestatīšanu), labotais teksts un ķeksis paliek", () => {
    const withManual: DealerSignalsState = {
      enabled: true,
      items: [
        { kind: "special_status", checked: false, manual: true, text: "Labots teksts" },
        { kind: "incidents", checked: false, text: "Vecs" },
      ],
    };
    const reset = regenerateDealerSignals(withManual, ["incidents", "auction_photos"], { keepEdits: false });
    expect(reset).toEqual({
      enabled: true,
      items: [
        { kind: "special_status", checked: false, manual: true, text: "Labots teksts" },
        { kind: "incidents", checked: true },
        { kind: "auction_photos", checked: true },
      ],
    });
    // Datos tips vairs nav - manuālais paliek, automātiskais pazūd.
    expect(regenerateDealerSignals(withManual, []).items.map((i) => i.kind)).toEqual(["special_status"]);
  });

  it("noņemšana un persistence (manual saglabājas, nederīga vērtība - ārā)", () => {
    const st = addManualDealerSignal(base, "special_status");
    expect(removeDealerSignal(st, "special_status")).toEqual(base);
    expect(removeDealerSignal(base, "us_history")).toBe(base);
    expect(
      parseDealerSignals({
        enabled: true,
        items: [
          { kind: "us_history", checked: true, manual: true },
          { kind: "special_status", checked: true, manual: "yes" },
        ],
      }),
    ).toEqual({
      enabled: true,
      items: [
        { kind: "special_status", checked: true },
        { kind: "us_history", checked: true, manual: true },
      ],
    });
  });
});
