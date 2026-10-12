import { describe, expect, it } from "vitest";

import {
  oemBrandForVin,
  parseAuctionArchive,
  parseNhtsaRecalls,
  parseVpicMakeModelYear,
  parseRdwOpenData,
  parseUkMot,
} from "@/lib/vin-scan/parse-extra";
import { detectVinScanMileageRollback } from "@/lib/vin-scan/summary";

describe("OEM WMI", () => {
  it("atpazīst marku pēc pirmajām 3 zīmēm", () => {
    expect(oemBrandForVin("WVWZZZ7NZEV015204")).toBe("vw");
    expect(oemBrandForVin("WBA5R1C0XLFH42873")).toBe("bmw");
    expect(oemBrandForVin("YV1DZ31A1F2705364")).toBe("volvo");
    expect(oemBrandForVin("TMBJH9NP9N7043581")).toBe("vw");
    expect(oemBrandForVin("VF12RFL1H49621453")).toBeNull();
  });
});

describe("NHTSA atsaukumi un RDW", () => {
  it("skaita atsaukumus", () => {
    expect(parseNhtsaRecalls(200, JSON.stringify({ results: [] })).status).toBe("none");
    expect(parseNhtsaRecalls(400, JSON.stringify({ Count: 0, Message: "Results returned successfully", results: [] })).status).toBe(
      "none",
    );
    expect(
      parseVpicMakeModelYear(
        200,
        JSON.stringify({ Results: [{ Make: "VOLKSWAGEN", Model: "SHARAN", ModelYear: "2013" }] }),
      ),
    ).toEqual({ make: "VOLKSWAGEN", model: "SHARAN", year: "2013" });
    expect(parseNhtsaRecalls(200, JSON.stringify({ results: [{ Component: "AIR BAGS" }, { Component: "FUEL" }] })).summary).toContain(
      "2",
    );
  });

  it("RDW NAP un APK", () => {
    const parsed = parseRdwOpenData({
      vehicle: [{ kenteken: "G123BB", merk: "VOLKSWAGEN", handelsbenaming: "GOLF", datum_eerste_toelating: "20120101", vervaldatum_apk: "20260101", tellerstandoordeel: "logisch", tellerstand: "145000" }],
      keuring: [],
      recalls: [{ referentiecode: "R1" }],
    });
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("NAP");
    expect(parsed.flags?.recallCount).toBe(1);
    expect(parsed.flags?.registrationCountry).toBe("NL");
  });

  it("UK MOT odometru rindas", () => {
    const parsed = parseUkMot(
      200,
      JSON.stringify([
        {
          make: "FORD",
          model: "FOCUS",
          firstUsedDate: "2015-03-01",
          motTests: [{ completedDate: "2024-02-01", odometerValue: "82000", odometerUnit: "mi", testResult: "PASSED" }],
        },
      ]),
    );
    expect(parsed.status).toBe("found");
    expect(parsed.mileage?.[0]?.odometer).toMatch(/km/);
  });
});

describe("izsoles arhīvs un nobraukuma rollback", () => {
  it("BidFax found ar VIN un lot", () => {
    expect(parseAuctionArchive(200, `<html>VIN WBA5R1C0XLFH42873 copart lot sold 12 photos</html>`, "WBA5R1C0XLFH42873", "BidFax").status).toBe(
      "found",
    );
    expect(parseAuctionArchive(404, "", "WBA5R1C0XLFH42873", "Poctra").status).toBe("none");
  });

  it("vēlāks datums ar mazāku km ir rollback", () => {
    expect(
      detectVinScanMileageRollback([
        { date: "2024-01-01", odometer: "100000 km", source: "a" },
        { date: "2025-01-01", odometer: "40000 km", source: "b" },
      ]),
    ).toBe(true);
    expect(
      detectVinScanMileageRollback([
        { date: "2024-01-01", odometer: "40000 km", source: "a" },
        { date: "2025-01-01", odometer: "80000 km", source: "b" },
      ]),
    ).toBe(false);
  });
});
