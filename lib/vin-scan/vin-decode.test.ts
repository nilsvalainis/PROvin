import { describe, expect, it } from "vitest";

import {
  decodeVinLocal,
  isNordicVinOrigin,
  mergeVinDecodeWithVpic,
  nordicVinSearchLinks,
  vinDecodeParseFromLocal,
  vinOriginCountryLabel,
} from "@/lib/vin-scan/vin-decode";

const VOLVO_SE = "YV1DZ5251B2146640";

describe("decodeVinLocal", () => {
  it("YV1 ir Volvo, Zviedrija, 2011, arī ar nederīgu kontrolciparu", () => {
    const d = decodeVinLocal(VOLVO_SE);
    expect(d.ok).toBe(true);
    expect(d.wmi).toBe("YV1");
    expect(d.make).toBe("Volvo");
    expect(d.countryCode).toBe("SE");
    expect(d.countryName).toBe("Zviedrija");
    expect(d.year).toBe("2011");
    expect(d.plant).toBe("2");
    expect(d.nordic).toBe(true);
    expect(d.checkDigitOk).toBe(false);
  });

  it("WMI tabula: BMW Vācija, Škoda Čehija, Honda ASV", () => {
    expect(decodeVinLocal("WBA5R1C0XLFH42873")).toMatchObject({
      make: "BMW",
      countryCode: "DE",
      nordic: false,
    });
    expect(decodeVinLocal("TMBJH9NP9N7043581")).toMatchObject({
      make: "Škoda",
      countryCode: "CZ",
    });
    expect(decodeVinLocal("1HGCM82633A004352")).toMatchObject({
      make: "Honda",
      countryCode: "US",
    });
  });

  it("YS2 / YS3 / YV4 ir Ziemeļvalstis", () => {
    expect(isNordicVinOrigin("YS2G4X20001234567")).toBe(true);
    expect(isNordicVinOrigin("YS3EB59E631234567")).toBe(true);
    expect(isNordicVinOrigin("YV4A22PK1G1234567")).toBe(true);
    expect(isNordicVinOrigin("WVWZZZ7NZEV015204")).toBe(false);
  });
});

describe("nordicVinSearchLinks", () => {
  it("Zviedrijas WMI dod biluppgifter.se un car.info saites ar VIN", () => {
    const links = nordicVinSearchLinks(VOLVO_SE);
    expect(links.map((l) => l.id)).toEqual(["biluppgifter", "carinfo"]);
    expect(links[0]?.href).toBe(`https://biluppgifter.se/${VOLVO_SE}`);
    expect(links[1]?.href).toBe(`https://www.car.info/en-se/vin/${VOLVO_SE}`);
    expect(nordicVinSearchLinks("WBA5R1C0XLFH42873")).toEqual([]);
  });
});

describe("vinDecodeParseFromLocal / vPIC merge", () => {
  it("lokālais dekodējums ir found ar marku un valsti", () => {
    const parsed = vinDecodeParseFromLocal(decodeVinLocal(VOLVO_SE));
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("Volvo");
    expect(parsed.summary).toContain("Zviedrija");
    expect(parsed.summary).toContain("2011");
    expect(parsed.vehicle).toMatchObject({ make: "Volvo", year: "2011" });
    expect(parsed.flags?.registrationCountry).toBe("SE");
    expect(parsed.detail).toContain("WMI YV1");
  });

  it("vPIC modeļa nosaukums pārklāj lokālo, WMI valsts paliek", () => {
    const merged = mergeVinDecodeWithVpic(decodeVinLocal(VOLVO_SE), {
      status: "found",
      summary: "2011 VOLVO XC60",
      vehicle: { make: "VOLVO", model: "XC60", year: "2011" },
    });
    expect(merged.summary).toContain("XC60");
    expect(merged.summary).toContain("Zviedrija");
    expect(merged.vehicle).toEqual({ make: "VOLVO", model: "XC60", year: "2011" });
    expect(merged.flags?.registrationCountry).toBe("SE");
  });

  it("vPIC kļūda atstāj lokālo dekodējumu", () => {
    const merged = mergeVinDecodeWithVpic(decodeVinLocal(VOLVO_SE), {
      status: "unknown",
      summary: "NHTSA atbildēja ar HTTP 500",
    });
    expect(merged.status).toBe("found");
    expect(merged.vehicle?.make).toBe("Volvo");
  });

  it("valsts etiķete", () => {
    expect(vinOriginCountryLabel("SE")).toBe("Zviedrija");
    expect(vinOriginCountryLabel("")).toBe("");
  });
});
