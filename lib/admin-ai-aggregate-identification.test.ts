import { describe, expect, it } from "vitest";
import {
  emptyCsddFields,
  emptyListingAnalysisBlock,
  mergeSourceBlocksWithDefaults,
} from "@/lib/admin-source-blocks";
import {
  buildAggregateIdentificationBrief,
  isBmw3SeriesChassis,
} from "@/lib/admin-ai-aggregate-identification";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";

describe("buildAggregateIdentificationBrief", () => {
  it("collects the parameters needed to derive engine, gearbox and mileage band", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        ...emptyCsddFields(),
        makeModel: "BMW 320D",
        firstRegistration: "2016-04-12",
        fuelType: "Dīzeļdegviela",
        engineDisplacementCm3: "1995",
        enginePowerKw: "140",
        emissionStandard: "EURO 6",
        mileageHistory: [
          { date: "10.05.2020", odometer: "120000", country: "Vācija" },
          { date: "18.03.2026", odometer: "245000", country: "Latvija" },
        ],
      },
    });

    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });

    expect(brief).toContain("Agregātu identifikācijas dati");
    expect(brief).toContain("BMW 320D");
    expect(brief).toContain("2016");
    expect(brief).toContain("vecums ~10 gadi");
    expect(brief).toContain("1995 cm³");
    expect(brief).toMatch(/140 kW \(~190 zs\)/);
    expect(brief).toContain("EURO 6");
    expect(brief).toMatch(/Jaunākais nobraukuma ieraksts: 245 000 km/);
    expect(brief).toMatch(/~24 500 km\/gadā/);
    expect(brief).toMatch(/1–2 kandidātus/);
    expect(brief).toMatch(/Aprīkojuma SA saraksts: nav/);
    expect(brief).toMatch(/BMW 3\. sērija/);
    expect(brief).toMatch(/NEKOPĒ/);
    expect(brief).not.toMatch(/NAV minēti/);
    expect(brief).not.toMatch(/Šie dārgie vecuma slazdi sarakstā NAV minēti/);
  });

  it("lists dealer equipment and flags expensive age options when present", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "BMW 525" },
      auto_records: {
        outvinReport: {
          vehicleInfo: {
            model: "BMW E61",
            modelSeries: "E61",
            vinCode: "",
            vehicleType: "PX61",
            transmission: "AUT",
            steeringSide: "LL",
            engineCode: "M57/T2",
            engineNumber: "",
            body: "TOU",
            drive: "HECK",
            power: "145 kW",
            integrationLevel: "",
            currentILevel: "",
            developmentCode: "E61",
            modelCode: "PX61",
            productionDate: "",
            firstRegistration: "",
            warrantyStartDate: "",
            countryRegion: "",
            color: "",
            colorCode: "",
            interior: "",
            interiorCode: "",
          },
          accidentCheck: "",
          stolenCheck: "",
          equipment: [
            { code: "0205", description: "Automatic transmission" },
            { code: "0255", description: "Sports leather steering wheel" },
            { code: "0217", description: "Active steering" },
            { code: "0677", description: "HiFi Professional DSP" },
            { code: "02BY", description: "BMW LA wheel" },
            { code: "0403", description: "Glass roof" },
          ],
        },
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/Piedziņa \(dīleris\): HECK \(aizmugures piedziņa\)/);
    expect(brief).toMatch(/Virsbūve \(dīleris\): TOU/);
    expect(brief).toMatch(/0217 — Active steering/);
    expect(brief).toMatch(/Dārgas vecuma pozīcijas sarakstā: Active steering/);
    expect(brief).toMatch(/E60\/E61/);
    expect(brief).not.toMatch(/NAV minēti/);
  });

  it("does not praise missing E60 options on an E90 with a long SA list", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "BMW 320i" },
      auto_records: {
        outvinReport: {
          ...emptyOutvinDealerReport(),
          vehicleInfo: {
            ...emptyOutvinDealerReport().vehicleInfo,
            model: "BMW 320i",
            developmentCode: "E90",
            engineCode: "N52",
          },
          equipment: [
            { code: "0205", description: "Automatic transmission" },
            { code: "0255", description: "Sports leather steering wheel" },
            { code: "0403", description: "Glass roof" },
            { code: "0521", description: "Rain sensor" },
            { code: "0431", description: "Interior mirror" },
            { code: "0320", description: "Deleted model designation" },
            { code: "0493", description: "Storage compartment" },
          ],
        },
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/BMW 3\. sērija/);
    expect(brief).toMatch(/Ja E90 N52/);
    expect(brief).toMatch(/NEKOPĒ/);
    expect(brief).not.toMatch(/NAV minēti/);
    expect(brief).not.toMatch(/Soft Close, Logic 7, Airmatic/);
  });

  it("recognises BMW 3-series chassis codes and type badges", () => {
    expect(isBmw3SeriesChassis("BMW 320i", "E90")).toBe(true);
    expect(isBmw3SeriesChassis("BMW 320D", "")).toBe(true);
    expect(isBmw3SeriesChassis("BMW 330d", "E91")).toBe(true);
    expect(isBmw3SeriesChassis("BMW 525d", "E61")).toBe(false);
  });

  it("returns empty text when no vehicle parameters are known", () => {
    expect(buildAggregateIdentificationBrief({ sourceBlocks: mergeSourceBlocksWithDefaults({}) })).toBe(
      "",
    );
  });

  it("flags a panoramic roof from dealer equipment for inspection drainage", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "VW Tiguan" },
      auto_records: {
        outvinReport: {
          ...emptyOutvinDealerReport(),
          vehicleInfo: { ...emptyOutvinDealerReport().vehicleInfo, model: "VW Tiguan" },
          equipment: [{ code: "S403A", description: "Panoramadach" }],
        },
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/LŪKA \/ PANORĀMAS LŪKA/);
    expect(brief).toMatch(/Panoramadach/);
    expect(brief).toMatch(/grīdas paklāji/);
    expect(brief).toMatch(/īpaši Volkswagen|VW grupā/);
  });

  it("flags a sunroof mentioned only in the listing and ignores roof rails", () => {
    const withListing = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "BMW 320d" },
      listing_analysis: {
        ...emptyListingAnalysisBlock(),
        listingPasteRaw: "Auto ar panorāmas lūku, kopts.",
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: withListing, nowYear: 2026 });
    expect(brief).toMatch(/LŪKA \/ PANORĀMAS LŪKA/);
    expect(brief).toMatch(/sludinājuma apraksts/);
    expect(brief).not.toMatch(/Volkswagen/);

    const railsOnly = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "BMW 320d" },
      listing_analysis: {
        ...emptyListingAnalysisBlock(),
        listingPasteRaw: "Jumta relingi, panorāmas kamera.",
      },
    });
    expect(buildAggregateIdentificationBrief({ sourceBlocks: railsOnly, nowYear: 2026 })).not.toMatch(
      /LŪKA \/ PANORĀMAS LŪKA/,
    );
  });
});
