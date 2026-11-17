import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  buildCsddFieldsFromPdfSources,
  buildCsddPdfParseResultFromTextLayer,
  csddTextLayerNeedsAiFallback,
  mergeCsddPdfRawSources,
  pickRicherCsddFields,
} from "@/lib/csdd-pdf-ingest";
import { previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";

const SAMPLE_RAW = `Iepriekšējās reģistrācijas valsts VĀCIJA
Transportlīdzekļa reģistrācija
 No 22/01/2016 3 īpašnieki
Nobraukuma vēsture
274516 - 16.12.2025
Iepriekšējās apskates dati
Pārbaudes veids:	Pamatpārbaude
Odometra rādījums:	274516
Novērtējums:	2 - Ar mēneša laikā labojamiem defektiem
Dūmainības koeficients (m-1):	0.58
Kods	Novērtējums:	Trūkumi vai bojājumi
5.3.4.	2	Priekšējais tilts. Palielināta brīvkustība.
Tehnisko apskašu vēsture
Apskates datums 04.12.2024
Novērtējums 1 - Ar pieļaujamiem defektiem`;

describe("csdd-pdf-ingest", () => {
  it("mergeCsddPdfRawSources keeps PDF layer when it has unique sections", () => {
    const pdf = SAMPLE_RAW;
    const ai = "Marka BMW\nReģistrācijas numurs AB-123";
    const merged = mergeCsddPdfRawSources(pdf, ai);
    expect(merged).toContain("Iepriekšējās reģistrācijas valsts");
    expect(merged).toContain("5.3.4.");
  });

  it("buildCsddFieldsFromPdfSources fills country and prev inspection from combined text", () => {
    const { fields } = buildCsddFieldsFromPdfSources({
      textHint: SAMPLE_RAW,
      aiRaw: "",
    });
    expect(fields.previousRegistrationCountry).toBe("VĀCIJA");
    expect(fields.ownerCountLatvia).toBe("3");
    expect(previousInspectionBlockHasData(fields.prevInspectionBlock)).toBe(true);
    expect(fields.prevInspectionBlock.defects.some((d) => d.code === "5.3.4.")).toBe(true);
    expect(fields.technicalInspectionHistory.length).toBeGreaterThan(0);
  });

  it("pickRicherCsddFields keeps AI owners and defects when the text layer is empty there", () => {
    const emptyPrev = emptyCsddFields().prevInspectionBlock;
    const ai = {
      ...emptyCsddFields(),
      ownerCountLatvia: "2",
      previousRegistrationCountry: "LIETUVA",
      fuelType: "Dīzeļdegviela",
      ownerRegistrationEvents: [{ date: "14.03.2018", label: "Pirmā reģistrācija Latvijā" }],
      technicalInspectionHistory: [
        {
          date: "02.09.2025",
          inspectionType: "pamatpārbaude",
          ratingLabel: "1",
          ratingLevel: 1 as const,
          maxDefectLevel: 1 as const,
          smokeCoefficient: "",
          notes: "",
          defects: [{ code: "4.1.1.", rating: "1", description: "Stūres brīvkustība" }],
        },
      ],
      prevInspectionBlock: {
        ...emptyPrev,
        inspectionDateText: "02.09.2025",
        odometer: "148100",
        defects: [{ code: "4.1.1.", rating: "1", description: "Stūres brīvkustība" }],
      },
    };
    const local = {
      ...emptyCsddFields(),
      registrationNumber: "NE6693",
      mileageHistory: [{ date: "02.09.2025", odometer: "148100", country: "Latvija" }],
      prevInspectionBlock: { ...emptyPrev, odometer: "148220" },
    };
    const merged = pickRicherCsddFields(ai, local);
    expect(merged.ownerCountLatvia).toBe("2");
    expect(merged.previousRegistrationCountry).toBe("LIETUVA");
    expect(merged.fuelType).toMatch(/Dīze/);
    expect(merged.registrationNumber).toBe("NE6693");
    expect(merged.mileageHistory[0]?.odometer).toBe("148100");
    expect(merged.ownerRegistrationEvents).toHaveLength(1);
    expect(merged.technicalInspectionHistory[0]?.defects).toHaveLength(1);
    expect(merged.prevInspectionBlock.defects).toHaveLength(1);
  });

  it("asks for AI when the text layer kept the plate but missed owners promised by the PDF", () => {
    const local = { ...emptyCsddFields(), registrationNumber: "NE6693" };
    const raw = `${SAMPLE_RAW}\nĪpašnieku skaits Latvijā 2\nIepriekšējā reģistrācijas valsts LIETUVA`;
    expect(csddTextLayerNeedsAiFallback(local, raw)).toBe(true);
    const filled = { ...local, ownerCountLatvia: "2", previousRegistrationCountry: "LIETUVA" };
    expect(csddTextLayerNeedsAiFallback(filled, "Reģistrācijas numurs NE6693")).toBe(false);
  });

  it("buildCsddPdfParseResultFromTextLayer matches paste-quality parse", () => {
    const parsed = buildCsddPdfParseResultFromTextLayer(SAMPLE_RAW, "csdd.pdf");
    expect(parsed?.fields.previousRegistrationCountry).toBe("VĀCIJA");
    expect(parsed?.meta.extractionMethod).toBe("text_layer");
  });
});
