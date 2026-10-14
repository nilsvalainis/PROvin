import { describe, expect, it } from "vitest";

import {
  oemBrandForVin,
  parseAuctionArchive,
  parseBiluppgifter,
  parseNicbHtml,
  parseNhtsaRecalls,
  parseTraficom,
  parseVegvesen,
  parseVpicMakeModelYear,
  parseRdwOpenData,
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
    expect(
      parseVpicMakeModelYear(200, JSON.stringify({ Results: [{ Make: "VOLVO", Model: "XC60", ModelYear: "" }] })),
    ).toEqual({ make: "VOLVO", model: "XC60", year: "" });
    const nhtsa = parseNhtsaRecalls(200, JSON.stringify({ results: [{ Component: "AIR BAGS" }, { Component: "FUEL" }] }));
    expect(nhtsa.summary).toContain("2");
    expect(nhtsa.recalls).toEqual([
      { title: "AIR BAGS", date: "" },
      { title: "FUEL", date: "" },
    ]);
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
});

describe("Traficom", () => {
  it("found ar marku un modeli ir FI", () => {
    const parsed = parseTraficom(200, "<html>Make VOLVO Model V70 Year 2008</html>");
    expect(parsed).toMatchObject({
      status: "found",
      vehicle: { make: "VOLVO", model: "V70", year: "2008" },
      flags: { registrationCountry: "FI" },
    });
  });

  it("ei löytynyt bez auto ir none", () => {
    expect(parseTraficom(200, "<html>Ajoneuvoa ei löytynyt</html>")).toMatchObject({
      status: "none",
      summary: "Traficom šo VIN neatpazina",
    });
  });

  it("Suomi.fi / captcha bez auto ir unknown, ne none", () => {
    expect(parseTraficom(200, "<html>Identify yourself Suomi.fi kirjaudu</html>").status).toBe("unknown");
    expect(parseTraficom(200, "<html>Just a moment Cloudflare captcha</html>").status).toBe("unknown");
    expect(parseTraficom(403, "").summary).toMatch(/atver pārlūkā/);
    expect(parseTraficom(404, "").summary).toMatch(/HTTP 404/);
    expect(parseTraficom(200, "<html>Model year: 2008</html>").status).toBe("unknown");
  });
});

describe("NICB un vegvesen", () => {
  it("NICB forma / captcha ir atver pārlūkā, ne lapa nav atpazīta", () => {
    expect(parseNicbHtml("<html>VINCheck Check a VIN g-recaptcha form_build_id</html>", "WBA5R1C0XLFH42873").summary).toMatch(
      /atver pārlūkā/,
    );
    expect(parseNicbHtml("<html>This VIN is not listed as stolen</html>", "WBA5R1C0XLFH42873").status).toBe("none");
    expect(parseNicbHtml("<html>random landing</html>", "WBA5R1C0XLFH42873").summary).not.toMatch(/nav atpazīta/);
  });

  it("vegvesen 401 ir pilnvara, ne kļūdas kods", () => {
    expect(parseVegvesen(401, "Unauthorized").summary).toMatch(/pilnvaru/);
    expect(parseVegvesen(403, "").summary).toMatch(/atver pārlūkā/);
  });

  it("biluppgifter 403 ir atver pārlūkā", () => {
    expect(parseBiluppgifter(403, "", "WBA5R1C0XLFH42873").summary).toMatch(/atver pārlūkā/);
  });
});

describe("izsoles arhīvs un nobraukuma rollback", () => {
  it("BidFax found ar VIN un lot", () => {
    expect(parseAuctionArchive(200, `<html>VIN WBA5R1C0XLFH42873 copart lot sold 12 photos</html>`, "WBA5R1C0XLFH42873", "BidFax").status).toBe(
      "found",
    );
    expect(parseAuctionArchive(404, "", "WBA5R1C0XLFH42873", "Poctra").status).toBe("none");
    expect(parseAuctionArchive(403, "", "WBA5R1C0XLFH42873", "Poctra").summary).toMatch(/atver pārlūkā/);
    expect(parseAuctionArchive(403, "", "WBA5R1C0XLFH42873", "BidFax").summary).toMatch(/atver pārlūkā/);
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
