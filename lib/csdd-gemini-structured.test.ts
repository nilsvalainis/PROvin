import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  csddFieldsFromStructuredGeminiPayload,
  csddTaExtractionLooksIncomplete,
  mergeCsddTaGeminiIntoFields,
  sanitizeCsddRegistrationNumber,
} from "@/lib/csdd-gemini-structured-map";

describe("sanitizeCsddRegistrationNumber", () => {
  it("strips glued Statuss label from plate", () => {
    expect(sanitizeCsddRegistrationNumber("KG982Statuss")).toBe("KG982");
    expect(sanitizeCsddRegistrationNumber("KG 982 Statuss")).toBe("KG982");
  });

  it("keeps valid plate", () => {
    expect(sanitizeCsddRegistrationNumber("KG982")).toBe("KG982");
  });
});

describe("csddFieldsFromStructuredGeminiPayload", () => {
  it("maps mileage, defects, and pamata dati", () => {
    const fields = csddFieldsFromStructuredGeminiPayload(
      {
        pamataDati: {
          markaModelis: "MERCEDES BENZ E220",
          registracijasNumurs: "KG982Statuss",
          pirmasRegistracijaLatvija: "22.01.2016",
          nakosasApskatesDatums: "12.01.2027",
          ieprieksejasApskatesDatums: "30.12.2025",
          degvielasVeids: "Dīzeļdegviela",
          pilnaMasaKg: 2360,
          pasmasaKg: 1810,
          ipasnickuSkaitsLatvija: 3,
        },
        nobraukumaVesture: [
          { datums: "2025-12-16", odometrs: 274726, valsts: "LV" },
          { datums: "2024-12-04", odometrs: 269950, valsts: "LV" },
        ],
        tehniskoApskasuVesture: [
          {
            datums: "16.12.2025",
            truukumi: [
              {
                kods: "5.3.4.",
                vertējums: 2,
                apraksts: "Priekšējais tilts. Palielināta brīvkustība balstiekārtas šarnīrā.",
              },
            ],
          },
        ],
      },
      "",
    );

    expect(fields.registrationNumber).toBe("KG982");
    expect(fields.makeModel).toBe("MERCEDES BENZ E220");
    expect(fields.fuelType).toBe("Dīzeļdegviela");
    expect(fields.grossMassKg).toBe("2360");
    expect(fields.curbMassKg).toBe("1810");
    expect(fields.ownerCountLatvia).toBe("3");
    expect(fields.mileageHistory.filter((r) => r.odometer.trim())).toHaveLength(2);
    expect(fields.mileageHistory[0]?.odometer).toBe("274726");
    expect(fields.technicalInspectionHistory[0]?.defects[0]?.code).toBe("5.3.4.");
    expect(fields.technicalInspectionHistory[0]?.defects[0]?.description).toContain("Priekšējais tilts");
  });

  it("drops boilerplate-only defects", () => {
    const fields = csddFieldsFromStructuredGeminiPayload(
      {
        pamataDati: { markaModelis: "TEST", registracijasNumurs: "AB123" },
        nobraukumaVesture: [],
        tehniskoApskasuVesture: [
          {
            datums: "01.01.2024",
            truukumi: [
              { kods: "", apraksts: "Nav reģistrētu trūkumu vai bojājumu" },
              { kods: "3.2.", vertējums: 1, apraksts: "Stiklojuma bojājumi." },
            ],
          },
        ],
      },
      "",
    );
    const defects = fields.technicalInspectionHistory[0]?.defects ?? [];
    expect(defects).toHaveLength(1);
    expect(defects[0]?.code).toBe("3.2.");
  });

  it("maps ieprieksejasApskatesDati into prevInspectionBlock", () => {
    const fields = csddFieldsFromStructuredGeminiPayload(
      {
        pamataDati: { markaModelis: "TEST", registracijasNumurs: "KG982" },
        nobraukumaVesture: [],
        tehniskoApskasuVesture: [],
        ieprieksejasApskatesDati: {
          datums: "30.12.2025",
          vertesanasSkaitlis: 2,
          truukumi: [{ kods: "503", vertesanas: 2, apraksts: "Bremžu tests." }],
        },
      },
      "",
    );
    expect(fields.prevInspectionBlock.defects).toHaveLength(1);
    expect(fields.prevInspectionBlock.defects[0]?.code).toBe("503");
  });
});

describe("csddTaExtractionLooksIncomplete", () => {
  it("flags empty TA with multiple Apskates datums in hint", () => {
    const fields = { ...emptyCsddFields(), technicalInspectionHistory: [] };
    const hint =
      "Tehnisko apskašu vēsture\nApskates datums 16.12.2025\nApskates datums 04.12.2024\nApskates datums 01.01.2020";
    expect(csddTaExtractionLooksIncomplete(fields, hint)).toBe(true);
  });

  it("does not flag when defects are present", () => {
    const fields = csddFieldsFromStructuredGeminiPayload(
      {
        pamataDati: { markaModelis: "X", registracijasNumurs: "AB1" },
        nobraukumaVesture: [],
        tehniskoApskasuVesture: [
          {
            datums: "01.01.2024",
            truukumi: [{ kods: "3.2.", vertesanas: 1, apraksts: "Stikls." }],
          },
        ],
      },
      "",
    );
    expect(csddTaExtractionLooksIncomplete(fields, "")).toBe(false);
  });
});

describe("mergeCsddTaGeminiIntoFields", () => {
  it("replaces empty TA history with second-pass rows", () => {
    const base = csddFieldsFromStructuredGeminiPayload(
      {
        pamataDati: { markaModelis: "MERCEDES", registracijasNumurs: "KG982" },
        nobraukumaVesture: [{ datums: "16.12.2025", odometrs: 274726, valsts: "LV" }],
        tehniskoApskasuVesture: [],
      },
      "",
    );
    const merged = mergeCsddTaGeminiIntoFields(base, {
      tehniskoApskasuVesture: [
        {
          datums: "16.12.2025",
          truukumi: [{ kods: "5.3.4.", vertesanas: 2, apraksts: "Tilts." }],
        },
        {
          datums: "04.12.2024",
          truukumi: [{ kods: "618", vertesanas: 1, apraksts: "Gaismas." }],
        },
      ],
    });
    expect(merged.mileageHistory.filter((r) => r.odometer.trim())).toHaveLength(1);
    expect(merged.technicalInspectionHistory).toHaveLength(2);
    expect(merged.technicalInspectionHistory[0]?.date).toBe("16.12.2025");
  });
});
