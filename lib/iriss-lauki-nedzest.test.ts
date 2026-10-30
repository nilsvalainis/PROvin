import { describe, expect, it } from "vitest";
import { parseEurInput, parseNumberFieldInput } from "@/lib/iriss-autoparks-v2-format";

describe("Lauki paši nenodzēšas (Nils 28.10)", () => {
  it("skaitļa lauks: atstarpes, km, komats - nolasās; nenolasāms netiek uzskatīts par tukšu", () => {
    expect(parseNumberFieldInput("171 048")).toBe(171048);
    expect(parseNumberFieldInput("171048 km")).toBe(171048);
    expect(parseNumberFieldInput("1,9")).toBe(1.9);
    expect(parseNumberFieldInput("125 kW")).toBe(125);
    expect(parseNumberFieldInput("")).toBeNull();
    expect(parseNumberFieldInput("apm. 170 tk")).toBe("invalid");
  });

  it("summa: eur, punkts kā tūkstošu atdalītājs", () => {
    expect(parseEurInput("17900 eur")).toBe(17900);
    expect(parseEurInput("17.900")).toBe(17900);
    expect(parseEurInput("17 900 €")).toBe(17900);
    expect(parseEurInput("185,50")).toBe(185.5);
    expect(parseEurInput("185.50")).toBe(185.5);
    expect(parseEurInput("abc")).toBeNull();
  });
});
