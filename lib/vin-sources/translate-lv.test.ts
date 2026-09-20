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
