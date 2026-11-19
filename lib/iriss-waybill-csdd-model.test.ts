import { describe, expect, it } from "vitest";
import { csddModelHint, normalizeCsddModel, splitCsddMake } from "@/lib/iriss-waybill-csdd-model";

const models = (make: string, text: string, known?: string[]) => normalizeCsddModel(make, text, known).map((c) => c.model);

describe("CSDD modelis no brīvā teksta (19.11)", () => {
  it("Volvo XC90 2.4 D5 Edition -> XC90 (bez dzinēja un komplektācijas)", () => {
    expect(models("Volvo", "XC90 2.4 D5 Edition")).toEqual(["XC90"]);
    expect(models("VOLVO", "Volvo XC90 2.4 D5 Edition")).toEqual(["XC90"]);
  });

  it("BMW 3ER 325D -> 325D (sērija nost, modeļa kods paliek)", () => {
    expect(models("BMW", "3ER 325D")).toEqual(["325D"]);
  });

  it("BMW 216D Gran Tourer -> 216D, otrais variants ar virsbūvi", () => {
    const c = normalizeCsddModel("BMW", "216D Gran Tourer");
    expect(c.map((x) => x.model)).toEqual(["216D", "216D GRAN TOURER"]);
    expect(c[0].confidence).toBeGreaterThan(c[1].confidence);
  });

  it("VW Golf, VW Arteon, MB E350 / E 350 CDI", () => {
    expect(models("VW", "Golf")).toEqual(["GOLF"]);
    expect(models("VW", "Arteon 2.0 TDI R-Line 4Motion")).toEqual(["ARTEON"]);
    expect(models("MB", "E350")).toEqual(["E350"]);
    expect(models("Mercedes-Benz", "E 350 CDI Avantgarde")).toEqual(["E350"]);
  });

  it("ar zināmu CSDD sarakstu atgriež tikai sarakstā esošos; nekas neatbilst -> tukšs (neminam)", () => {
    expect(models("BMW", "216D Gran Tourer", ["216D GRAN TOURER", "218D"])).toEqual(["216D GRAN TOURER"]);
    expect(models("Volvo", "XC90 2.4 D5 Edition", ["XC60", "XC90"])).toEqual(["XC90"]);
    expect(models("Volvo", "XC90 2.4 D5 Edition", ["XC60", "V90"])).toEqual([]);
  });

  it("nav modeļa (tikai dzinējs/komplektācija) -> tukšs", () => {
    expect(models("Volvo", "2.4 D5 Edition")).toEqual([]);
    expect(models("BMW", "")).toEqual([]);
  });

  it("marka: VW/MB aizstājvārdi, «3ER» bez markas = BMW", () => {
    expect(splitCsddMake("VW Golf")).toMatchObject({ make: "VOLKSWAGEN", rest: "Golf" });
    expect(splitCsddMake("Land Rover Range Rover Sport")).toMatchObject({ make: "LAND ROVER", rest: "Range Rover Sport" });
    expect(splitCsddMake("3ER 325D")).toMatchObject({ make: "BMW", makeAsTyped: "", rest: "3ER 325D" });
  });
});

describe("formas ieteikums «CSDD modelis»", () => {
  it("rāda ieteikumu un ko ielikt laukā", () => {
    expect(csddModelHint("Volvo XC90 2.4 D5 Edition")).toEqual({ model: "XC90", apply: "Volvo XC90" });
    expect(csddModelHint("BMW 3ER 325D")).toEqual({ model: "325D", apply: "BMW 325D" });
    expect(csddModelHint("3ER 325D")).toEqual({ model: "325D", apply: "BMW 325D" });
    expect(csddModelHint("BMW 216D Gran Tourer")).toEqual({ model: "216D", apply: "BMW 216D" });
  });

  it("teksts jau der CSDD - ieteikuma nav", () => {
    expect(csddModelHint("VW Golf")).toBeNull();
    expect(csddModelHint("VW Arteon")).toBeNull();
    expect(csddModelHint("MB E350")).toBeNull();
    expect(csddModelHint("Volvo")).toBeNull();
    expect(csddModelHint("")).toBeNull();
  });
});
