import { describe, expect, it } from "vitest";

import {
  decodeVinLocal,
  isEuWmiVin,
  isNordicVinOrigin,
  isUsWmiVin,
  mergeVinDecodeWithVpic,
  nordicVinSearchLinks,
  vinDecodeParseFromLocal,
  vinOriginCountryLabel,
} from "@/lib/vin-scan/vin-decode";

const VOLVO_SE = "YV1DZ5251B2146640";

describe("decodeVinLocal", () => {
  it("YV1 ir Volvo, Zviedrija; Eiropas VIN gadu un kontrolciparu nedekodē", () => {
    const d = decodeVinLocal(VOLVO_SE);
    expect(d.ok).toBe(true);
    expect(d.wmi).toBe("YV1");
    expect(d.make).toBe("Volvo");
    expect(d.countryCode).toBe("SE");
    expect(d.countryName).toBe("Zviedrija");
    expect(d.year).toBe("");
    expect(d.plant).toBe("2");
    expect(d.nordic).toBe(true);
    expect(d.checkDigitOk).toBe(null);
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
    expect(isEuWmiVin("WBA5R1C0XLFH42873")).toBe(true);
    expect(isEuWmiVin("YV1DZ5251B2146640")).toBe(true);
    expect(isEuWmiVin("WVWZZZ7NZEV015204")).toBe(true);
    expect(isEuWmiVin("1HGCM82633A004352")).toBe(false);
    expect(isUsWmiVin("1HGCM82633A004352")).toBe(true);
    expect(isUsWmiVin("WBA5R1C0XLFH42873")).toBe(false);
  });

  it("Kanādas (2...) un Meksikas (3...) VIN ir ASV tirgus, ne ES", () => {
    expect(decodeVinLocal("2T1BURHE0JC123456").countryCode).toBe("CA");
    expect(decodeVinLocal("3VWFE21C04M000001").countryCode).toBe("MX");
    expect(isUsWmiVin("2T1BURHE0JC123456")).toBe(true);
    expect(isUsWmiVin("3VWFE21C04M000001")).toBe(true);
    expect(isEuWmiVin("2T1BURHE0JC123456")).toBe(false);
    expect(isEuWmiVin("3VWFE21C04M000001")).toBe(false);
    expect(isUsWmiVin("JTDKN3DU0A0123456")).toBe(false);
    expect(isUsWmiVin("YV1DZ5251B2146640")).toBe(false);
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
    expect(links[1]?.href).toBe(`https://www.car.info/en-se/vin/S/${VOLVO_SE}`);
    expect(nordicVinSearchLinks("WBA5R1C0XLFH42873")).toEqual([]);
  });
});

describe("vinDecodeParseFromLocal / vPIC merge", () => {
  it("lokālais dekodējums ir found ar marku un valsti", () => {
    const parsed = vinDecodeParseFromLocal(decodeVinLocal(VOLVO_SE));
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("Volvo");
    expect(parsed.summary).toContain("Zviedrija");
    expect(parsed.summary).not.toContain("2011");
    expect(parsed.vehicle).toMatchObject({ make: "Volvo", year: "" });
    expect(parsed.flags?.manufactureCountry).toBe("SE");
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
    // Eiropas VIN: vPIC gads arī ir no 10. zīmes, to neņem.
    expect(merged.vehicle).toEqual({ make: "VOLVO", model: "XC60", year: "" });
    expect(merged.flags?.manufactureCountry).toBe("SE");
  });

  it("Eiropas VIN: gads tikai no reģistra, vPIC 1981 neņem", () => {
    const merged = mergeVinDecodeWithVpic(
      decodeVinLocal(VOLVO_SE),
      { status: "found", summary: "Daļējs dekodējums: 1981 VOLVO", vehicle: { make: "VOLVO", model: "", year: "1981" } },
      { registryYear: "2011" },
    );
    expect(merged.vehicle?.year).toBe("2011");
    expect(merged.vehicle?.make).toBe("VOLVO");
    expect(merged.summary).toContain("2011");
    expect(merged.flags?.manufactureCountry).toBe("SE");
  });

  it("ASV VIN: vPIC 1981 (ISO cikls) neaizstāj lokālo 2003", () => {
    const merged = mergeVinDecodeWithVpic(decodeVinLocal("1HGCM82633A004352"), {
      status: "found",
      summary: "1973 HONDA",
      vehicle: { make: "HONDA", model: "", year: "1973" },
    });
    expect(merged.vehicle?.year).toBe("2003");
  });

  it("WDD2122931A366915 (Mercedes): nav «2001», nav kontrolcipara kļūdas", () => {
    const d = decodeVinLocal("WDD2122931A366915");
    expect(d.make.toUpperCase()).toContain("MERCEDES");
    expect(d.year).toBe("");
    expect(d.checkDigitOk).toBe(null);
    const parsed = vinDecodeParseFromLocal(d);
    expect(parsed.summary).not.toContain("2001");
    expect(parsed.detail ?? "").not.toContain("kontrolcipars");
    const merged = mergeVinDecodeWithVpic(d, {
      status: "found",
      summary: "2001 MERCEDES-BENZ",
      vehicle: { make: "MERCEDES-BENZ", model: "", year: "2001" },
    });
    expect(merged.vehicle?.year).toBe("");
    expect(merged.summary).not.toContain("2001");
  });

  it("ASV VIN: kontrolcipars joprojām tiek pārbaudīts", () => {
    expect(decodeVinLocal("1HGCM82633A004352").checkDigitOk).toBe(true);
    expect(decodeVinLocal("1M8GDM9A0KP042788").checkDigitOk).toBe(false);
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
