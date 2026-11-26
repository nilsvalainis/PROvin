/**
 * 26.11 (Nils, BMW X5 2004 no Austrijas): CSDD «Iepriekšējā reģistrācijas valsts» ir tikai pēdējā valsts
 * pirms Latvijas. Pirmās reģistrācijas valsti no tās neatvasina; ārvalstu periodu sadala pierādītajā
 * posmā («Austrija (pierādāms no 2015)») un «Iepriekš - valsts nav zināma».
 * Dati anonimizēti (VIN, numurs izdomāti), datumi un km kā pasūtījumā.
 */
import { describe, expect, it } from "vitest";
import {
  mergeSourceBlocksWithDefaults,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { buildCsddOwnerMileageBlockHtml } from "@/lib/owner-mileage-block-html";
import {
  buildOwnerMileagePeriods,
  formatOwnerMileageFactLines,
  ownerMileageInputFromCsdd,
  ownerMileageReadingsFromUnifiedRows,
} from "@/lib/owner-mileage-periods";
import { checkSourceConsistency } from "@/lib/source-consistency";
import { collectUnifiedMileageRows, prepareUnifiedMileageDisplayRows } from "@/lib/unified-mileage";
import {
  buildVehicleLifecycleEvents,
  lifecycleDatedCountryRecords,
  vehicleFirstRegistrationSummary,
  type LifecycleInput,
} from "@/lib/vehicle-lifecycle-timeline";

const NOW = Date.UTC(2026, 10, 26);
const VIN = "WBAXX00000XX66575";

function x5Blocks(): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults({
    csdd: {
      vin: VIN,
      makeModel: "BMW X5",
      modelYear: "2004",
      firstRegistration: "2004-08-20",
      firstRegistrationLatvia: "2021-11-26",
      previousRegistrationCountry: "AUSTRIJA",
      ownerCountLatvia: "2",
      ownerRegistrationEvents: [
        { date: "26.11.2021", label: "Pirmā reģistrācija Latvijā" },
        { date: "11.05.2022", label: "Īpašnieka maiņa" },
      ],
      mileageHistory: [
        { date: "12.02.2026", odometer: "317679", country: "Latvija" },
        { date: "03.01.2023", odometer: "299404", country: "Latvija" },
        { date: "17.12.2021", odometer: "291180", country: "Latvija" },
      ],
    },
    // Dīlera ieraksti 2007-2012 bez valsts («Nezināma»).
    auto_records: {
      serviceHistory: [
        { date: "07.08.2012", odometer: "192845", country: "" },
        { date: "20.04.2011", odometer: "169469", country: "" },
        { date: "22.11.2008", odometer: "101550", country: "" },
        { date: "19.04.2007", odometer: "71600", country: "" },
      ],
    },
    carvertical: {
      serviceHistory: [
        { date: "01.12.2021", odometer: "291180", country: "Latvija" },
        { date: "01.07.2004", odometer: "17", country: "" },
      ],
    },
    // Austrijas §57a apskates: 2015-2018 bez km, 2019-2020 ar km.
    citi_avoti: {
      sections: [
        {
          serviceHistory: [
            { date: "23.11.2020", odometer: "278597", country: "Austrija" },
            { date: "29.10.2019", odometer: "270476", country: "Austrija" },
            { date: "30.10.2018", odometer: "", country: "Austrija" },
            { date: "04.08.2016", odometer: "", country: "Austrija" },
            { date: "13.11.2015", odometer: "", country: "Austrija" },
          ],
          // Nila ievadītā Austrijas reģistra laikposma josla (26.11).
          vehicleHistoryTimeline: [
            { date: "13.11.2015", country: "Austrija", description: "Veikta tehniskā apskate", includeInPdf: true },
            { date: "04.08.2016", country: "Austrija", description: "Veikta tehniskā apskate", includeInPdf: true },
            { date: "05.10.2017", country: "Austrija", description: "Veikta tehniskā apskate", includeInPdf: true },
            { date: "30.10.2018", country: "Austrija", description: "Veikta tehniskā apskate", includeInPdf: true },
            { date: "29.10.2019", country: "Austrija", description: "Veikta tehniskā apskate", odometer: "270476", includeInPdf: true },
            { date: "23.11.2020", country: "Austrija", description: "Veikta tehniskā apskate", odometer: "278597", includeInPdf: true },
          ],
          incidents: [],
          comments: "",
          aiContextRaw: "",
          photoGroups: [],
          photos: [],
          label: "Austrija · §57a apskates",
        },
      ],
    },
  });
}

function lifecycleInput(b: WorkspaceSourceBlocks): LifecycleInput {
  return {
    csddForm: b.csdd,
    autoRecordsBlock: b.auto_records,
    manualVendorBlocks: toPdfManualVendorBlocks(b),
    citiAvoti: b.citi_avoti,
  };
}

function ownerRows(b: WorkspaceSourceBlocks) {
  return ownerMileageReadingsFromUnifiedRows(
    prepareUnifiedMileageDisplayRows(
      collectUnifiedMileageRows({
        csddForm: b.csdd,
        autoRecordsBlock: b.auto_records,
        manualVendorBlocks: toPdfManualVendorBlocks(b),
        citiAvotiBlock: b.citi_avoti,
      }),
    ),
  );
}

describe("pirmās reģistrācijas valsts (BMW X5, CSDD iepriekšējā - Austrija)", () => {
  it("laikjoslā «Pirmā reģistrācija» bez valsts; pāreja «Austrija → Latvija» paliek", () => {
    const events = buildVehicleLifecycleEvents(lifecycleInput(x5Blocks()));
    const first = events.find((e) => e.kind === "first_registration");
    expect(first?.date).toBe("20.08.2004");
    expect(first?.country).toBe("");
    expect(vehicleFirstRegistrationSummary(events).country).toBe("");
    expect(events.some((e) => e.kind === "import" && e.title === "Austrija → Latvija")).toBe(true);
  });

  it("Austrijas reģistra laikposma rindas ir stipras (nav pelēkas); «Nav zināma → Austrija» 13.11.2015", () => {
    const events = buildVehicleLifecycleEvents(lifecycleInput(x5Blocks()));
    const at = events.filter((e) => e.kind === "inspection" && e.country === "Austrija");
    expect(at.map((e) => e.date)).toEqual(["13.11.2015", "04.08.2016", "05.10.2017", "30.10.2018", "29.10.2019", "23.11.2020"]);
    expect(at.every((e) => !e.timelineInformational && !e.countryUnverified)).toBe(true);
    const imports = events.filter((e) => e.kind === "import");
    expect(imports.map((e) => [e.date, e.title, e.fromCountryUnknown === true])).toEqual([
      ["13.11.2015", "Nav zināma → Austrija", true],
      ["26.11.2021", "Austrija → Latvija", false],
    ]);
  });

  it("valsts ieraksts gada laikā pēc 1. reģistrācijas - «Nav zināma →» nerāda", () => {
    const b = x5Blocks();
    b.auto_records = { ...b.auto_records, serviceHistory: [] };
    b.carvertical = { ...b.carvertical, serviceHistory: [] };
    b.citi_avoti.sections[0]!.vehicleHistoryTimeline = [
      { date: "10.02.2005", country: "Austrija", description: "Veikta tehniskā apskate", includeInPdf: true },
    ];
    b.citi_avoti.sections[0]!.serviceHistory = [];
    const imports = buildVehicleLifecycleEvents(lifecycleInput(b)).filter((e) => e.kind === "import");
    expect(imports.map((e) => e.title)).toEqual(["Austrija → Latvija"]);
  });

  it("AI faktu lapā valsts «nav zināma», CSDD iepriekšējā valsts - tikai pēdējā pirms Latvijas", () => {
    const facts = buildCanonicalFacts({ vin: VIN, sourceBlocks: x5Blocks() });
    expect(facts.firstReg.date).toBe("20.08.2004");
    expect(facts.firstReg.countryLv).toBe("");
    expect(facts.firstReg.countryIso).toBe("");
    expect(facts.sheet).toContain("izcelsmes valsts nav zināma");
    expect(facts.sheet).toContain("CSDD iepriekšējā reģistrācijas valsts: Austrija - tikai PĒDĒJĀ valsts pirms Latvijas");
    expect(facts.sheet).toContain("Austrija pierādāma tikai no 13.11.2015");
    expect(facts.sheet).not.toMatch(/izcelsmes valsts: Austrija/);
  });

  it("ārvalstu periods sadalīts: «Iepriekš - valsts nav zināma» + «Austrija (pierādāms no 2015)»", () => {
    const b = x5Blocks();
    const records = lifecycleDatedCountryRecords(lifecycleInput(b));
    const r = buildOwnerMileagePeriods(ownerMileageInputFromCsdd(b.csdd, ownerRows(b), NOW, records)!)!;
    expect(r.abroadLastCountry).toBe("Austrija");
    expect(r.abroad?.country).toBe("");
    expect(r.abroad?.duration).toEqual({ years: 17, months: 3 });
    expect(r.abroadSegments).toHaveLength(2);
    const [unknown, known] = r.abroadSegments;
    expect(unknown!.countryUnknown).toBe(true);
    expect(unknown!.country).toBe("");
    expect(new Date(unknown!.t1).toISOString().slice(0, 10)).toBe("2015-11-13");
    expect(known!.country).toBe("Austrija");
    expect(new Date(known!.countryProvenFromT!).toISOString().slice(0, 10)).toBe("2015-11-13");
    expect(new Date(known!.t1).toISOString().slice(0, 10)).toBe("2021-11-26");
    // Posmu km kopā = viss ārvalstu periods.
    expect((unknown!.km ?? 0) + (known!.km ?? 0)).toBe(r.abroad!.km);
    const lines = formatOwnerMileageFactLines(r).join("\n");
    expect(lines).toContain("Austrija pierādāma tikai no 13.11.2015");
    expect(lines).toContain("NERAKSTĪT, ka auto visu ārvalstu laiku bijis Austrijā");
  });

  it.each([
    ["lv", "Iepriekš - valsts nav zināma", "Austrija (pierādāms no 2015)"],
    ["en", "Earlier - country unknown", "Austria (proven from 2015)"],
    ["ru", "Ранее - страна неизвестна", "(подтверждено с 2015)"],
    ["de", "Zuvor - Land unbekannt", "(belegt ab 2015)"],
  ] as const)("bloks «Īpašnieki un nobraukums» (%s)", (lang, unknownLabel, knownLabel) => {
    const b = x5Blocks();
    const html = buildCsddOwnerMileageBlockHtml(b.csdd, ownerRows(b), {
      lang,
      nowMs: NOW,
      countryRecords: lifecycleDatedCountryRecords(lifecycleInput(b)),
    });
    expect(html).toContain(unknownLabel);
    expect(html).toContain(knownLabel);
  });

  it("bez neviena datēta ieraksta ar valsti - periodam valsti nerāda (tikai «Ārvalstīs»)", () => {
    const b = x5Blocks();
    b.citi_avoti = { sections: [] };
    const html = buildCsddOwnerMileageBlockHtml(b.csdd, ownerRows(b), {
      nowMs: NOW,
      countryRecords: lifecycleDatedCountryRecords(lifecycleInput(b)),
    });
    expect(html).toContain("Ārvalstīs");
    expect(html).not.toContain("Austrija");
    const r = buildOwnerMileagePeriods(ownerMileageInputFromCsdd(b.csdd, ownerRows(b), NOW, [])!)!;
    expect(r.abroadSegments).toHaveLength(1);
    expect(r.abroadSegments[0]!.country).toBe("");
    expect(formatOwnerMileageFactLines(r).join("\n")).toContain("CSDD iepriekšējā valsts Austrija ir tikai pēdējā valsts pirms Latvijas");
  });

  it("valsts pierādāma gada laikā pēc 1. reģistrācijas - viens posms ar valsti, bez «pierādāms no»", () => {
    const b = x5Blocks();
    const r = buildOwnerMileagePeriods(
      ownerMileageInputFromCsdd(b.csdd, ownerRows(b), NOW, [{ t: Date.UTC(2005, 1, 1), iso: "AT" }])!,
    )!;
    expect(r.abroadSegments).toHaveLength(1);
    expect(r.abroad?.country).toBe("Austrija");
    expect(r.abroadSegments[0]!.countryProvenFromT).toBeUndefined();
  });

  it("AI teksts «pirmoreiz reģistrēta Austrijā» -> brīdinājums (1. lapā «Nav zināma»)", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: x5Blocks(),
      texts: [{ label: "Kopsavilkums", text: "Automašīna pirmoreiz reģistrēta Austrijā 2004. gadā." }],
      nowMs: NOW,
    });
    const first = issues.find((i) => i.id === "ai_first_reg_country");
    expect(first?.values[0]).toEqual({ source: "1. lapa", value: "Nav zināma" });
  });

  it("PDF 1. lapā pirmā reģistrācija 20.08.2004 ar «Valsts nav zināma», ne Austrija", () => {
    const b = x5Blocks();
    const payload = {
      sessionId: "cs_test",
      vin: VIN,
      created: NOW,
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
      csddForm: b.csdd,
      autoRecordsBlock: b.auto_records,
      manualVendorBlocks: toPdfManualVendorBlocks(b),
      citiAvoti: b.citi_avoti,
      ltab: "",
      tirgus: "",
      citi: "",
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
    } as unknown as ClientReportPayload;
    const html = buildClientReportDocumentHtml({
      payload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const i = html.indexOf("Pirmā reģistrācija</p>");
    expect(i).toBeGreaterThan(0);
    const card = html.slice(i, i + 300);
    expect(card).toContain("20.08.2004");
    expect(card).toContain("Valsts nav zināma");
    expect(card).not.toContain("Austrija");
    // Laikjoslā pāreja «Nav zināma → Austrija» ar karogu tikai pierādītajai pusei.
    expect(html).toContain('aria-label="Nav zināma → Austrija"');
    expect(html).toContain('aria-label="Austrija → Latvija"');
  });
});
