/**
 * 23.11.2026 dīlera atskaite W1K2132161A909201 (Mercedes E 300 de S213, OM654 plug-in hybrid, 2020,
 * Dānija). Fiksācija bez personas datiem: tikai VIN, servisa rindas, ražotāja komplektācija un reģistra rindas.
 *
 * 1) AI rakstīja „4MATIC ar pilnpiedziņu”, bet ražotāja komplektācija 4x2 (RWD), DMR „Baghjulstrukket”.
 * 2) FLASH MAX / ✨ padeva veco (21.11) komentāru kā „operatora melnrakstu” - vecā struktūra palika.
 * 3) Mercedes „Apkope A/B” (ASSYST) vienmēr ietver dzinēja eļļas maiņu - 5 vizītes netika skaitītas.
 * 5) Modelis: operatora labojums uzvar; „E220” sērija pie E 300 de netiek rādīta.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.fn();
vi.mock("@/lib/admin-ai-dispatch", () => ({
  hasAnyAdminAiProviderKey: () => true,
  adminGenerateExpertText: (opts: { userPrompt: string }) => generate(opts),
}));

import {
  createDefaultSourceBlocks,
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
import { buildDealerCodeFactsForPrompt } from "@/lib/dealer-code-facts-prompt";
import { buildDealerQualityGateInput, evaluateDealerQualityGate } from "@/lib/dealer-quality-gate";
import { emptyOutvinDataBundle, migrateOutvinReportToBundle } from "@/lib/outvin-data-bundle";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { keepVolumeUnitLowercase } from "@/lib/outvin-dealer-pdf-html";
import { buildOilIntervalSeriesForBlock } from "@/lib/oil-change-interval-chart";
import { isEngineOilChangeWork, isManufacturerOilServiceWork, oilClaimCautionHtml } from "@/lib/oil-change-intervals";
import { classifyDealerVisitKind, dealerVisitKindLabel } from "@/lib/pdf-dealer-timeline";
import {
  extractOemDrivetrain,
  extractRegistryDrivetrain,
  extractVehicleDrivetrain,
  findDrivetrainContradictions,
  parseDrivetrainText,
  stripAwdClaimsForTwoWheelDrive,
} from "@/lib/registry-drivetrain";
import {
  dealerVehicleInfoForDisplay,
  isMakeOnlyVehicleName,
  modelSeriesContradictsName,
  pickVehicleDisplayName,
  resolveVehicleDisplayName,
} from "@/lib/vehicle-display-name";

const VIN = "W1K2132161A909201";
const NOW = Date.UTC(2026, 10, 23);

const r = (date: string, odometer: string, works: string): AutoRecordsServiceWorkRow => ({
  date,
  odometer,
  location: "Ejner Hessel - Aalborg",
  works,
});

/** Dīlera rindas tieši kā pasūtījumā (LV tulkojums). */
const ROWS: AutoRecordsServiceWorkRow[] = [
  r("15.10.2025", "253086", "Apkope B."),
  r("26.05.2025", "228442", "Apkope A."),
  r("08.01.2025", "203591", "Apkope B."),
  r("18.07.2024", "178063", "Apkope A."),
  r("16.02.2024", "154346", "Apkope B."),
  r(
    "18.08.2023",
    "128079",
    "Dzinējs: eļļas un filtra maiņa.\nAutomātiskā pārnesumkārba: eļļas un filtra maiņa.\nPutekļu filtra maiņa.\nApkope A.\nAdBlue® uzpilde.",
  ),
  r("03.03.2023", "101596", "Dzinējs: eļļas un filtra maiņa.\nPutekļu filtra maiņa.\nApkope B.\nAdBlue® uzpilde."),
  r(
    "12.09.2022",
    "77058",
    "Dzinējs: eļļas un filtra maiņa.\nGaisa filtra ieliktņa maiņa.\nDegvielas filtra maiņa.\nBremžu šķidruma maiņa.\nApkope A.",
  ),
  r("12.04.2022", "51401", "Dzinējs: eļļas un filtra maiņa.\nPutekļu filtra maiņa.\nApkope B.\nAdBlue® uzpilde."),
  r("31.08.2021", "25993", "Dzinējs: eļļas un filtra maiņa.\nPutekļu filtra maiņa.\nApkope A.\nAdBlue® uzpilde."),
];

function blocks(opts: { manualModel?: string; comments?: string; oil?: string } = {}): WorkspaceSourceBlocks {
  const b = mergeSourceBlocksWithDefaults(createDefaultSourceBlocks());
  const apiInfo = {
    ...emptyOutvinVehicleInfo(),
    model: "MERCEDES-BENZ",
    modelSeries: "E220",
    drive: "4x2 (RWD)",
    engineCode: "1950 cc, 143 kW (194 PS), Plug-in Hybrid",
    vinCode: VIN,
  };
  b.auto_records = {
    ...b.auto_records,
    serviceWorks: ROWS,
    comments: opts.comments ?? "",
    oilChangeIntervalNotes: opts.oil ?? "",
    outvin: { ...emptyOutvinDataBundle(VIN), vehicleInfo: apiInfo },
    outvinReport: {
      vehicleInfo: { ...apiInfo, model: opts.manualModel ?? apiInfo.model },
      equipment: [],
      accidentCheck: "",
      stolenCheck: "",
    },
  };
  b.csdd = { ...b.csdd, makeModel: "MERCEDES BENZ E 300 DE 4MATIC" };
  b.tjekbil = {
    ...b.tjekbil,
    statusRecords:
      "Degviela: Dīzelis\nJauda / piedziņa: 194 HK (143 kW) · Aizmugurējo riteņu piedziņa\nDzenošās asis (DMR): 2 (pilnpiedziņa)",
    rawUnprocessedData:
      '{"maerkeTypeNavn": "MERCEDES-BENZ", "modelTypeNavn": "E-Klasse", "variantTypeNavn": "300 de Stationcar 9G-TRONIC", "traekkendeAksler": "2", "traekhjul": "Baghjulstrukket"}',
  };
  return b;
}

describe("3. Mercedes «Apkope A/B» = dzinēja eļļas maiņa (ASSYST)", () => {
  it("A/B marķieri visās valodās; A/C (kondicionieris) un parasts teikums - nē", () => {
    for (const t of ["Apkope B.", "Apkope A", "Service A.", "Service B plus", "Wartung A", "Serviceumfang B", "A-Service", "B-Service"]) {
      expect(isEngineOilChangeWork(t), t).toBe(true);
      expect(isManufacturerOilServiceWork(t), t).toBe(true);
    }
    for (const t of ["Apkope", "Service", "Service A/C", "Klimaservice", "performed a service", "Serviceabwicklung", "Apkope ar diagnostiku"]) {
      expect(isEngineOilChangeWork(t), t).toBe(false);
    }
  });

  it("W1K2132161A909201: 10 eļļas maiņas (bija 5), «Apkope A/B» vizītes = «Apkope», nav robu pēc 18.08.2023", () => {
    const ar = mergeSourceBlocksWithDefaults(blocks()).auto_records;
    const series = buildOilIntervalSeriesForBlock(ar, { nowMs: NOW });
    expect(series.points).toHaveLength(10);
    expect(series.points.at(-1)).toMatchObject({ date: "15.10.2025" });
    expect(classifyDealerVisitKind("Apkope B.")).toBe("maintenance");
    expect(dealerVisitKindLabel(classifyDealerVisitKind("Apkope A."))).toBe("Apkope");
  });

  it("statiskā piezīme saka, ka ražotāja A/B apkopes skaitām", () => {
    expect(oilClaimCautionHtml({ makeModel: "Mercedes-Benz E 350" })).toContain("Mercedes-Benz „Apkope A” / „Apkope B”");
  });
});

describe("1. piedziņa: ražotāja komplektācija 4x2 pret CSDD «4MATIC» un DMR asu skaitu", () => {
  it("parseDrivetrainText", () => {
    expect(parseDrivetrainText("4x2 (RWD)")).toEqual({ awd: false });
    expect(parseDrivetrainText("Rear-Wheel Drive")).toEqual({ awd: false });
    expect(parseDrivetrainText("All-wheel Drive")).toEqual({ awd: true });
    expect(parseDrivetrainText("4MATIC")).toEqual({ awd: true });
    expect(parseDrivetrainText("")).toBeNull();
  });

  it("OEM 4x2 ir prioritāra; DMR skaidri nosaukta aizmugurējā piedziņa uzvar asu skaitu 2", () => {
    const b = blocks();
    expect(extractOemDrivetrain(b)).toMatchObject({ awd: false, drivenAxles: 1 });
    expect(extractRegistryDrivetrain(b)).toMatchObject({ awd: false, drivenAxles: 1 });
    expect(extractVehicleDrivetrain(b)).toMatchObject({ awd: false });
  });

  it("drošības tīkls izmet «4MATIC» / «ar pilnpiedziņu»; noliegums paliek", () => {
    const dt = extractVehicleDrivetrain(blocks());
    expect(stripAwdClaimsForTwoWheelDrive("Mercedes-Benz E 300 de 4MATIC universālis ar pilnpiedziņu. Pēdējais ieraksts 15.10.2025.", dt)).toBe(
      "Mercedes-Benz E 300 de universālis. Pēdējais ieraksts 15.10.2025.",
    );
    expect(stripAwdClaimsForTwoWheelDrive("Auto nav pilnpiedziņa.", dt)).toBe("Auto nav pilnpiedziņa.");
    expect(stripAwdClaimsForTwoWheelDrive("Teksts 4MATIC.", { drivenAxles: 2, awd: true, sourceLabel: "x" })).toBe("Teksts 4MATIC.");
    expect(findDrivetrainContradictions("E 300 de 4MATIC universālis ar pilnpiedziņu.", dt)).toHaveLength(1);
  });

  it("koda faktu sarakstā: modelis un piedziņa ar aizliegumu", () => {
    const facts = buildDealerCodeFactsForPrompt(blocks({ manualModel: "Mercedes-Benz E 300 de" }), NOW);
    expect(facts).toContain("Modelis (tas pats nosaukums, ko PDF): Mercedes-Benz E 300 de.");
    // 24.11: DMR (oficiālais reģistrs) ir augstāka ticamība nekā ražotāja katalogs - abi saka RWD.
    expect(facts).toMatch(/Piedziņa \(oficiālais reģistrs .*NAV pilnpiedziņa; aizliegts rakstīt .*4MATIC/);
    expect(facts).toContain("Dzinēja eļļas maiņas (tā pati tabula kā PDF): 10");
  });

  it("ēnu režīms: 4MATIC un vecā struktūra - aizturēt", () => {
    const job = { vin: VIN, status: "done", serviceEventCount: 10, aiGenerated: true } as Parameters<
      typeof buildDealerQualityGateInput
    >[0]["job"];
    const oil = "Ražotāja intervāls: 25 000 km / 12 mēn. (OM654). Dīlera datos fiksētas 10 dzinēja eļļas maiņas.";
    const awd = evaluateDealerQualityGate(
      buildDealerQualityGateInput({
        job,
        sourceBlocks: blocks({ oil, comments: "Mercedes-Benz E 300 de 4MATIC universālis ar pilnpiedziņu. Pēdējais ieraksts 15.10.2025." }),
        pdf: null,
        nowMs: NOW,
      }),
    );
    expect(awd.checks.find((c) => c.id === "contradictions")).toMatchObject({ state: "fail" });
    const old = evaluateDealerQualityGate(
      buildDealerQualityGateInput({
        job,
        sourceBlocks: blocks({ oil, comments: "<strong>Agregātu un aprīkojuma identifikācija</strong><br>Mercedes-Benz E 300 de universālis." }),
        pdf: null,
        nowMs: NOW,
      }),
    );
    expect(old.checks.find((c) => c.id === "forbidden")).toMatchObject({ state: "fail", place: "comments" });
  });
});

describe("2. dīlera ✨ / FLASH MAX: vecais lauka teksts nav «operatora melnraksts»", () => {
  it("existingDraftPlain dīlera laukam promptā neiet; pilnpiedziņa izmesta pēc AI", async () => {
    generate.mockReset();
    generate.mockResolvedValue("Automātiskās pārnesumkārbas eļļas maiņa 18.08.2023 (128 079 km). E 300 de 4MATIC ar pilnpiedziņu.");
    const out = await generateSourceCommentWithAi({
      sessionId: "cs_test",
      blockKey: "auto_records",
      targetField: "comments",
      vin: VIN,
      sourceBlocks: blocks(),
      existingDraftPlain: "Agregātu un aprīkojuma identifikācija Mercedes-Benz E 300 de 4MATIC universālis",
      isolateDealerComments: true,
      checkoutLine: "dealer",
    });
    const prompt = String(generate.mock.calls[0]![0].userPrompt);
    expect(prompt).not.toContain("Esošais melnraksts");
    expect(prompt).not.toContain("Agregātu un aprīkojuma identifikācija Mercedes");
    expect(prompt).toContain("NAV pilnpiedziņa");
    expect(out).not.toMatch(/4MATIC|pilnpiedziņ/);
    expect(out).toContain("128 079 km");
  });
});

describe("5. vienots modeļa nosaukums", () => {
  it("operatora labojums uzvar; API vērtība to vairs nepārraksta tabulā", () => {
    const b = blocks({ manualModel: "Mercedes-Benz E 300 de" });
    expect(resolveVehicleDisplayName(b)).toBe("Mercedes-Benz E 300 de");
    const ar = mergeSourceBlocksWithDefaults(b).auto_records;
    const bundle = migrateOutvinReportToBundle(ar.outvinReport, ar.outvin!);
    expect(bundle.vehicleInfo.model).toBe("Mercedes-Benz E 300 de");
  });

  it("bez labojuma: CSDD pirms OneAuto; 2WD auto bez «4MATIC» marķiera", () => {
    expect(resolveVehicleDisplayName(blocks())).toBe("MERCEDES BENZ E 300 DE");
  });

  it("tikai marka - ņem modeli no cita avota (DMR), nekad tikai «MERCEDES-BENZ»", () => {
    const b = blocks();
    b.csdd = { ...b.csdd, makeModel: "" };
    expect(resolveVehicleDisplayName(b)).toBe("MERCEDES-BENZ E-Klasse 300 de Stationcar");
    expect(isMakeOnlyVehicleName("MERCEDES-BENZ")).toBe(true);
    expect(pickVehicleDisplayName([{ value: "BMW", source: "dealer_api" }]).name).toBe("BMW");
    expect(
      pickVehicleDisplayName([
        { value: "MERCEDES-BENZ", source: "csdd" },
        { value: "Mercedes-Benz E 300 de", source: "dealer_api" },
      ]).name,
    ).toBe("Mercedes-Benz E 300 de");
  });

  it("sērija «E220» pie «E 300 de» netiek rādīta; saskanīga sērija paliek", () => {
    expect(modelSeriesContradictsName("E220", "Mercedes-Benz E 300 de")).toBe(true);
    expect(modelSeriesContradictsName("E220", "Mercedes-Benz E 220 d")).toBe(false);
    expect(modelSeriesContradictsName("5 Touring (F11)", "BMW 530d")).toBe(false);
    const vi = dealerVehicleInfoForDisplay({ model: "MERCEDES-BENZ", modelSeries: "E220" }, "Mercedes-Benz E 300 de");
    expect(vi).toEqual({ model: "Mercedes-Benz E 300 de", modelSeries: "" });
    expect(dealerVehicleInfoForDisplay({ model: "BMW 530d", modelSeries: "F11" }, "BMW")).toEqual({ model: "BMW 530d", modelSeries: "F11" });
  });

  it("«1950 cc» tilpuma vienība paliek ar mazo burtu", () => {
    expect(keepVolumeUnitLowercase("1950 Cc, 143 kW (194 PS), Plug-in Hybrid")).toBe("1950 cc, 143 kW (194 PS), Plug-in Hybrid");
    expect(keepVolumeUnitLowercase("1995 Ccm")).toBe("1995 ccm");
  });
});

describe("taksometra / nomas rūpnīcas aprīkojums koda faktu sarakstā", () => {
  const withEquip = (vin: string, equipment: { code: string; description: string }[]) => {
    const b = blocks();
    b.auto_records = {
      ...b.auto_records,
      outvin: { ...b.auto_records.outvin!, vin, vehicleInfo: { ...b.auto_records.outvin!.vehicleInfo, vinCode: vin }, equipment },
    };
    return b;
  };

  it("WDD2120251A120979 (E 350 CDI W212): 965 + 937 kā fakts ar nozīmi", () => {
    const facts = buildDealerCodeFactsForPrompt(
      withEquip("WDD2120251A120979", [
        { code: "937", description: "REINFORCEMENT PACKAGE" },
        { code: "965", description: "ELECTR. PROVISION FOR HIRED CARS / TAXICAB" },
        { code: "580", description: "Air conditioning" },
      ]),
      NOW,
    );
    expect(facts).toContain("937 REINFORCEMENT PACKAGE (taksometra / nomas pastiprinājuma pakete)");
    expect(facts).toContain("965 ELECTR. PROVISION FOR HIRED CARS / TAXICAB (elektroinstalācijas sagatave taksometram / nomas auto)");
    expect(facts).toMatch(/OBLIGĀTI min kā faktu/);
  });

  it("izņēmumi (9A0, «Without taxi alarm», «Parts excluded for TAXI») - nav faktu rindas", () => {
    const facts = buildDealerCodeFactsForPrompt(
      withEquip(VIN, [
        { code: "9A0", description: "TAXI Adm variant" },
        { code: "551", description: "Anti-theft alarm without taxi alarm" },
        { code: "U99", description: "Parts excluded for TAXI" },
      ]),
      NOW,
    );
    expect(facts).not.toMatch(/taksometra vai nomas izpildījums/);
  });
});
