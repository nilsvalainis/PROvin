import { describe, expect, it } from "vitest";
import { capitalizeRegistryEvent } from "@/lib/vin-sources/translate-lv";

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
