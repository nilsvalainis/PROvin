import { describe, expect, it } from "vitest";
import { decodeVin } from "@/lib/vin-decode";
import { decodeVinModel } from "@/lib/vin-model-codes";

const NOW = new Date("2026-10-29T00:00:00Z");

function model(vin: string) {
  const d = decodeVin(vin, NOW);
  if (!d.ok) throw new Error("bad vin");
  return decodeVinModel(d, NOW);
}

describe("decodeVinModel - VW grupa", () => {
  it("Škoda Superb III ar modeļa gadu 2017", () => {
    expect(model("TMBJH9NP9H7561596")).toMatchObject({
      make: "Škoda",
      model: "Superb",
      generation: "III",
      modelYear: 2017,
      scheme: "vag",
      code: "NP",
    });
  });

  it("Audi A6 C7, VW Sharan II, Škoda Kodiaq, VW Golf VIII", () => {
    expect(model("WAUZZZ4G0EN168091")).toMatchObject({ make: "Audi", model: "A6 / A7", generation: "C7", modelYear: 2014 });
    expect(model("WVWZZZ7NZEV015204")).toMatchObject({ make: "Volkswagen", model: "Sharan", generation: "II", modelYear: 2014 });
    expect(model("TMBLD9NS7J8038392")).toMatchObject({ make: "Škoda", model: "Kodiaq", modelYear: 2018 });
    expect(model("WVWZZZCDZMW000123")).toMatchObject({ model: "Golf", generation: "VIII", modelYear: 2021 });
  });

  it("platformas kods ar vairākiem modeļiem rāda visus (pārbaudē atrastas kļūdas)", () => {
    expect(model("VSSZZZ5FZJ6000123")).toMatchObject({ make: "SEAT", model: "Leon / Ateca", modelYear: 2018 });
    expect(model("WVWZZZ1KZ9W000123")).toMatchObject({ model: "Golf / Golf Plus / Jetta", modelYear: 2009 });
    expect(model("WVGZZZ1TZLW000123")).toMatchObject({ model: "Touran", modelYear: 2020 });
    expect(model("WV2ZZZST7RH000123")).toMatchObject({ model: "Multivan", generation: "T7", modelYear: 2024 });
  });

  it("Cupra modeļiem marka Cupra, nevis SEAT", () => {
    expect(model("VSSZZZKMZNR000123")).toMatchObject({ make: "Cupra", model: "Formentor", modelYear: 2022 });
  });

  it("gada kods ārpus paaudzes gadiem -> modeli nerāda", () => {
    // 1K (Golf V) ar gadu 2025 nav iespējams.
    expect(model("WVWZZZ1KZSW000123")).toBeNull();
  });

  it("nezināms modeļa kods vai ne-Eiropas formāts (bez ZZZ) -> null", () => {
    expect(model("WVWZZZXXZEW000123")).toBeNull();
    expect(model("WVWAB7AJ0EW000123")).toBeNull();
  });
});

describe("decodeVinModel - Mercedes-Benz", () => {
  it("Baureihe no 4.-6. zīmes, gadu nerāda", () => {
    expect(model("WDD2130041A179362")).toMatchObject({ model: "E-klase", generation: "W213", modelYear: null, scheme: "mercedes", code: "213" });
    expect(model("W1K1186121N098109")).toMatchObject({ model: "CLA", generation: "C118" });
    expect(model("WDB9061331N534460")).toMatchObject({ model: "Sprinter", generation: "906" });
  });

  it("apvidus WMI (WDC) dalītam numuram dod GLK, vieglajam C-klasi", () => {
    expect(model("WDC2049841F820739")).toMatchObject({ model: "GLK", generation: "X204" });
    expect(model("WDD2042011F567789")).toMatchObject({ model: "C-klase", generation: "W204" });
  });

  it("ASV formāts (burti 4.-9. zīmē) un nezināma sērija -> null", () => {
    expect(model("WDDZF4JB5HA000123")).toBeNull();
    expect(model("WDD9990041A000123")).toBeNull();
  });
});

describe("decodeVinModel - Volvo un BMW", () => {
  it("Volvo: modelis no 4.-5. zīmes ar modeļa gadu", () => {
    expect(model("YV1BW7051A1153569")).toMatchObject({ make: "Volvo", model: "V70", generation: "III", modelYear: 2010, scheme: "volvo", code: "BW" });
    expect(model("YV1DZ875XC2000123")).toMatchObject({ model: "XC60", generation: "I", modelYear: 2012 });
  });

  it("BMW: tikai pārbaudītie kodi; bez gada, ja 10. zīme ir 0", () => {
    expect(model("WBA5R1C0XLFH42873")).toMatchObject({ make: "BMW", model: "3. sērija", generation: "G20 / G21", modelYear: 2020, scheme: "bmw" });
    expect(model("WBA5K11000D083631")).toMatchObject({ model: "5. sērija", generation: "F10 / F11", modelYear: null });
    expect(model("WBAXX11000D083631")).toBeNull();
  });

  it("iemācītā tabula: tikai markām bez savas shēmas", () => {
    expect(model("WF0MXXGBWMD012345")).toMatchObject({ make: "Ford", model: "Galaxy", scheme: "learned", produced: null, modelYear: null });
    expect(model("W0VXXXZZZMD012345")).toBeNull();
  });

  it("ārpus Eiropas VIN modeli nerāda", () => {
    expect(model("1HGCM82633A004352")).toBeNull();
  });
});
