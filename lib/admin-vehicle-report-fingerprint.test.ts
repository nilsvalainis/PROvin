import { describe, expect, it } from "vitest";
import { emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  extractVehicleReportFingerprint,
  formatVehicleFingerprintLabel,
  scoreVehicleFingerprintSimilarity,
} from "@/lib/admin-vehicle-report-fingerprint";

describe("extractVehicleReportFingerprint", () => {
  it("parses CSDD make/model and registration year", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        ...emptyCsddFields(),
        makeModel: "MERCEDES BENZ E220",
        firstRegistration: "2016-01-22",
        fuelType: "Dīzeļdegviela",
        engineDisplacementCm3: "2143",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks);
    expect(fp.makeModel).toContain("MERCEDES");
    expect(fp.year).toBe(2016);
    expect(fp.fuelType).toContain("dīze");
  });

  it("dod priekšroku OE VIN Lookup / dīlera degvielai pret CSDD", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        ...emptyCsddFields(),
        makeModel: "Audi A5",
        fuelType: "Dīzeļdegviela",
      },
      auto_records: {
        outvinReport: {
          vehicleInfo: {
            vinCode: "WAUZZZF59KA075097",
            series: "",
            typeCode: "",
            steeringSide: "",
            interior: "",
            model: "A5 35 TFSI",
            generation: "",
            engineCode: "DLVB",
            color: "",
            transmission: "",
            fuel: "Petrol",
          },
          accidentCheck: "",
          stolenCheck: "",
          equipment: [],
        },
      },
    });
    const fp = extractVehicleReportFingerprint(blocks);
    expect(fp.engineCode).toBe("DLVB");
    expect(fp.fuelType).toMatch(/petrol/i);
  });
});

describe("scoreVehicleFingerprintSimilarity", () => {
  it("ranks same engine and transmission higher than unrelated models", () => {
    const mercedes = extractVehicleReportFingerprint(
      mergeSourceBlocksWithDefaults({
        csdd: { ...emptyCsddFields(), makeModel: "MERCEDES BENZ E220", firstRegistration: "2016-01-22" },
        auto_records: {
          outvinReport: {
            vehicleInfo: {
              vinCode: "",
              series: "",
              typeCode: "",
              steeringSide: "",
              interior: "",
              model: "E220",
              generation: "",
              engineCode: "OM651",
              color: "",
              transmission: "Automatic",
            },
            accidentCheck: "",
            stolenCheck: "",
            equipment: [],
          },
        },
      }),
    );
    const similar = extractVehicleReportFingerprint(
      mergeSourceBlocksWithDefaults({
        csdd: { ...emptyCsddFields(), makeModel: "MERCEDES E220 CDI", firstRegistration: "2015-06-01" },
        auto_records: {
          outvinReport: {
            vehicleInfo: {
              vinCode: "",
              series: "",
              typeCode: "",
              steeringSide: "",
              interior: "",
              model: "E220",
              generation: "",
              engineCode: "OM651",
              color: "",
              transmission: "Automatic",
            },
            accidentCheck: "",
            stolenCheck: "",
            equipment: [],
          },
        },
      }),
    );
    const different = extractVehicleReportFingerprint(
      mergeSourceBlocksWithDefaults({
        csdd: { ...emptyCsddFields(), makeModel: "TOYOTA YARIS", firstRegistration: "2019-03-10" },
      }),
    );

    const similarScore = scoreVehicleFingerprintSimilarity(mercedes, similar);
    const differentScore = scoreVehicleFingerprintSimilarity(mercedes, different);
    expect(similarScore).toBeGreaterThan(50);
    expect(similarScore).toBeGreaterThan(differentScore);
    expect(formatVehicleFingerprintLabel(mercedes)).toContain("2016");
  });
});
