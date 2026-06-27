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
