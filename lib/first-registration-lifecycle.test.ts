import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyCsddFields,
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { applyClientReportStaticTranslations } from "@/lib/client-report-i18n";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import { buildVehicleLifecycleEvents, type LifecycleEvent } from "@/lib/vehicle-lifecycle-timeline";

/**
 * 21.11 (Nils): vēsturē tikai VIENA „Pirmā reģistrācija” (agrākā jebkurā valstī) ar valsti, ja tā droša.
 * Valstu nacionālās pirmās reģistrācijas ir „Reģistrācija <valstī>”. Nekad „pasaulē”, nekad „Nezināmā”.
 */

const DIR = path.join(__dirname, "__fixtures__", "mileage-etalons");

function fixtureBlocks(vin: string): { blocks: WorkspaceSourceBlocks; listingUrl: string | null } {
  const fx = JSON.parse(readFileSync(path.join(DIR, `${vin}.json`), "utf8")) as {
    listingUrl: string | null;
    sourceBlocks: WorkspaceSourceBlocks;
  };
  return { blocks: mergeSourceBlocksWithDefaults(fx.sourceBlocks), listingUrl: fx.listingUrl };
}

function lifecycleOf(vin: string): LifecycleEvent[] {
  const { blocks: b, listingUrl } = fixtureBlocks(vin);
  return buildVehicleLifecycleEvents({
    csddForm: b.csdd,
    autoRecordsBlock: b.auto_records,
    oneautoBlock: b.oneauto,
    ccVinBlock: b.cc_vin,
    asvBlock: b.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(b),
    citiAvoti: b.citi_avoti,
    tirgusForm: b.tirgus,
    listingUrl,
  });
}

function firstRegs(events: LifecycleEvent[]): LifecycleEvent[] {
  return events.filter((e) => e.kind === "first_registration");
}

function national(events: LifecycleEvent[]): string[] {
  return events.filter((e) => e.nationalRegistration && e.kind === "registration").map((e) => `${e.date} ${e.title}`);
}

const CASES: { vin: string; label: string; date: string; country: string; national: string[] }[] = [
  {
    vin: "WDC1671191A002835",
    label: "GLE 300d EE → LV",
    date: "26.03.2019",
    country: "Igaunija",
    national: ["01.03.2023 Reģistrācija Latvijā"],
  },
  {
    vin: "SADCA2BK6HA098675",
    label: "Jaguar F-Pace DK → LV",
    date: "05.01.2017",
    country: "Dānija",
    national: ["05.02.2025 Reģistrācija Latvijā"],
  },
  {
    vin: "WBA7J21040G829261",
    label: "BMW 740Le LU → FI → LV",
    date: "20.04.2017",
    country: "Luksemburga",
    national: ["29.09.2021 Reģistrācija Somijā", "26.06.2026 Reģistrācija Latvijā"],
  },
  {
    vin: "WDD2130501A166423",
    label: "E350e NL → FI → LV",
    date: "16.12.2016",
    country: "Nīderlande",
    national: ["03.03.2022 Reģistrācija Somijā", "28.05.2026 Reģistrācija Latvijā"],
  },
  {
    vin: "WVGZZZE2ZNP009103",
    label: "VW ID.4 FI → LV",
    date: "08.11.2021",
    country: "Somija",
    national: ["22.09.2026 Reģistrācija Latvijā"],
  },
  {
    vin: "WBAGW41050BP49719",
    label: "BMW 840d DE → EE → LV",
    date: "04.03.2020",
    country: "Vācija",
    national: ["23.04.2026 Reģistrācija Latvijā"],
  },
  {
    vin: "TMBJH9NP9H7561596",
    label: "Škoda Superb SE → LV",
    date: "04.08.2017",
    country: "Zviedrija",
    national: [],
  },
  {
    vin: "JTEBZ29J500168234",
    label: "Land Cruiser - jauns Latvijā",
    date: "20.03.2008",
    country: "Latvija",
    national: [],
  },
];

describe("Pirmā reģistrācija: viena kartīte, pareiza valsts (etaloni)", () => {
  for (const c of CASES) {
    it(`${c.label} (${c.vin})`, () => {
      const events = lifecycleOf(c.vin);
      const fr = firstRegs(events);
      expect(fr).toHaveLength(1);
      expect(fr[0]!.title).toBe("Pirmā reģistrācija");
      expect(fr[0]!.date).toBe(c.date);
      expect(fr[0]!.country).toBe(c.country);
      expect(fr[0]!.detail).not.toMatch(/pasaulē|1\. reģistrācija/i);
      expect(national(events)).toEqual(c.national);
    });
  }

  it("BMW 740: Traficom „Nodošana ekspluatācijā” ir tā pati pirmā reģistrācija, ne atsevišķa kartīte", () => {
    const events = lifecycleOf("WBA7J21040G829261");
    expect(events.some((e) => /ekspluatācijā/i.test(e.title))).toBe(false);
    expect(firstRegs(events)[0]!.sources).toContain(SOURCE_BLOCK_LABELS.traficom_fi);
  });

  it("visās 41 lietās: ne vairāk par vienu pirmo reģistrāciju, nekad „Nezināmā” vai „pasaulē”", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(41);
    for (const f of files) {
      const events = lifecycleOf(f.replace(/\.json$/, ""));
      const fr = firstRegs(events);
      expect(fr.length, f).toBeLessThanOrEqual(1);
      for (const e of fr) {
        expect(e.country === "" || countryLabelToIso2(e.country) != null, `${f}: ${e.country}`).toBe(true);
      }
      expect(events.filter((e) => e.kind !== "first_registration" && e.title === "Pirmā reģistrācija"), f).toEqual([]);
      expect(events.some((e) => /pasaulē/i.test(`${e.title} ${e.detail}`)), f).toBe(false);
    }
  });

  it("AI faktu lapa: izcelsme no tās pašas loģikas, nacionālās reģistrācijas atsevišķi", () => {
    const { blocks, listingUrl } = fixtureBlocks("WBA7J21040G829261");
    const facts = buildCanonicalFacts({ vin: "WBA7J21040G829261", listingUrl, sourceBlocks: blocks });
    // CSDD iepriekšējā valsts ir Somija, bet izcelsme ir Luksemburga.
    expect(facts.firstReg.countryIso).toBe("LU");
    expect(facts.firstReg.date).toBe("20.04.2017");
    expect(facts.sheet).toMatch(/Pirmā reģistrācija: 20\.04\.2017 \| izcelsmes valsts: Luksemburga \(LU\)/);
    expect(facts.sheet).toMatch(/NAV pirmā reģistrācija.*Somija 29\.09\.2021; Latvija 26\.06\.2026/);
  });
});

describe("Pirmā reģistrācija: sintētiski gadījumi", () => {
  it("jauns Latvijas auto (Yaris tipa): viena kartīte Latvijā, bez „Reģistrācija Latvijā”", () => {
    const events = buildVehicleLifecycleEvents({
      csddForm: {
        ...emptyCsddFields(),
        firstRegistration: "2019-05-14",
        firstRegistrationLatvia: "2019-05-14",
        ownerRegistrationEvents: [
          { date: "14.05.2019", label: "Pirmā reģistrācija Latvijā" },
          { date: "02.03.2023", label: "Īpašnieka maiņa" },
        ],
      },
    });
    const fr = firstRegs(events);
    expect(fr).toHaveLength(1);
    expect(fr[0]!.date).toBe("14.05.2019");
    expect(fr[0]!.country).toBe("Latvija");
    expect(national(events)).toEqual([]);
    expect(events.filter((e) => e.kind === "import")).toEqual([]);
  });

  it("valsts nav droša - karogu nerāda (nekad „Nezināmā”)", () => {
    const events = buildVehicleLifecycleEvents({
      csddForm: { ...emptyCsddFields(), firstRegistration: "2015-02-10", firstRegistrationLatvia: "2024-06-01" },
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "02.2015", odometer: "10", country: "Nezināmā" }],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const fr = firstRegs(events);
    expect(fr).toHaveLength(1);
    expect(fr[0]!.country).toBe("");
    expect(national(events)).toEqual(["01.06.2024 Reģistrācija Latvijā"]);
  });

  it("finnik „Pirmā reģistrācija Nīderlandē” bez agrākiem datiem ir pirmā reģistrācija; ar agrāku DE - nacionālā", () => {
    const nl = (earlierDe: boolean) =>
      buildVehicleLifecycleEvents({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.finnik,
            mileageRows: [],
            incidentRows: [],
            comments: "",
            vehicleHistoryTimeline: [
              {
                date: "18.05.2019",
                country: "Nīderlande",
                description: "Pirmā reģistrācija Nīderlandē",
                odometer: "",
                includeInPdf: true,
              },
            ],
          },
          {
            title: SOURCE_BLOCK_LABELS.tjekbil,
            mileageRows: [],
            incidentRows: [],
            comments: "",
            vehicleHistoryTimeline: earlierDe
              ? [{ date: "20.03.2017", country: "Vācija", description: "Tehniskā apskate", odometer: "15000", includeInPdf: true }]
              : [],
          },
        ],
      });
    const native = nl(false);
    expect(firstRegs(native)).toHaveLength(1);
    expect(firstRegs(native)[0]!.country).toBe("Nīderlande");

    const imported = nl(true);
    expect(firstRegs(imported)).toHaveLength(0);
    expect(national(imported)).toEqual(["18.05.2019 Reģistrācija Nīderlandē"]);
  });
});

function minimalPayload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WBA7J21040G829261",
    created: Date.now(),
    amountTotal: 7999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    ...overrides,
  } as ClientReportPayload;
}

describe("PDF: pirmās reģistrācijas lauki un datumi", () => {
  it("CSDD blokā „Pirmā reģistrācija:” un „Pirmā reģistrācija Latvijā:” ar DD.MM.YYYY; EN tulkojums", () => {
    const csdd = {
      ...emptyCsddFields(),
      makeModel: "BMW 740LE",
      firstRegistration: "2017-04-20",
      firstRegistrationLatvia: "2026-06-26",
      previousRegistrationCountry: "SOMIJA",
    };
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.traficom_fi,
            mileageRows: [],
            incidentRows: [],
            comments: "",
            vehicleHistoryTimeline: [
              {
                date: "29.09.2021",
                country: "Somija",
                description: "Pirmā reģistrācija Somijā",
                odometer: "",
                includeInPdf: true,
              },
            ],
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("Pirmā reģistrācija:");
    expect(html).toContain("Pirmā reģistrācija Latvijā:");
    expect(html).toContain("20.04.2017");
    expect(html).toContain("26.06.2026");
    expect(html).not.toContain("2017-04-20");
    expect(html).not.toMatch(/pasaulē/);
    expect(html).toContain("Reģistrācija Somijā");
    expect(html).toContain("Reģistrācija Latvijā");
    const en = applyClientReportStaticTranslations(html, "en");
    expect(en).toContain("First registration:");
    expect(en).toContain("Registration in Finland");
    expect(en).not.toMatch(/worldwide/);
  });
});
