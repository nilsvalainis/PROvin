import { describe, expect, it } from "vitest";
import { capitalizeFactValue, capitalizeRegistryEvent, translateTextLv } from "@/lib/vin-sources/translate-lv";

describe("capitalizeRegistryEvent", () => {
  it("paceļ pirmo burtu un tekstu pēc kolona", () => {
    expect(capitalizeRegistryEvent("periodiskā apskate: izturēta · FDM Test & Bilsyn")).toBe(
      "Periodiskā apskate: Izturēta · FDM Test & Bilsyn",
    );
    expect(capitalizeRegistryEvent("Apdrošināšana: GF-FORSIKRING A/S, beigusies")).toBe(
      "Apdrošināšana: GF-FORSIKRING A/S, beigusies",
    );
    expect(capitalizeRegistryEvent("Pirmā reģistrācija")).toBe("Pirmā reģistrācija");
  });
});

describe("capitalizeFactValue", () => {
  it("paceļ pirmo burtu, pēc komata un iekavās", () => {
    expect(capitalizeFactValue("dīzelis")).toBe("Dīzelis");
    expect(capitalizeFactValue("16.10.2024, izturēta")).toBe("16.10.2024, Izturēta");
    expect(capitalizeFactValue("GF-FORSIKRING A/S (beigusies)")).toBe("GF-FORSIKRING A/S (Beigusies)");
    expect(capitalizeFactValue("300 HK (221 kW) · pilnpiedziņa")).toBe("300 HK (221 kW) · Pilnpiedziņa");
  });
});

describe("translateTextLv", () => {
  it("tulko Dānijas piedziņas apzīmējumu", () => {
    expect(translateTextLv("300 HK (221 kW) · Firehjulstrukket", "da")).toMatch(/pilnpiedziņa/);
  });
});

describe("translateTextLv igauņu frāzes", () => {
  it("frāze uzvar pār atsevišķu vārdu („korras”)", () => {
    expect(translateTextLv("OK - Tehniliselt korras", "et")).toBe("OK - tehniski kārtībā");
    expect(translateTextLv("korras", "et")).toBe("izturēta");
  });

  it("tulko vārdus ar õ / ü / ä (\\b tur nestrādāja)", () => {
    expect(translateTextLv("Võõrandamisest teatamine", "et")).toBe("paziņojums par atsavināšanu");
    expect(translateTextLv("Majanduslikus mõttes hävinenud", "et")).toBe(
      "ekonomiski neizdevīgi remontēt (norakstīts)",
    );
    expect(translateTextLv("12.03.2021 Liiklusõnnetus", "et")).toBe("12.03.2021 ceļu satiksmes negadījums");
    expect(translateTextLv("Kontroll: ülevaatus puudustega", "et")).toBe("Kontroll: tehniskā apskate ar trūkumiem");
  });

  it("nemaina vārda daļu un jau tulkotu tekstu", () => {
    expect(translateTextLv("korrastatud", "et")).toBe("korrastatud");
    expect(translateTextLv("300 HK · Firehjulstrukket", "da")).toBe("300 HK · pilnpiedziņa");
  });
});
