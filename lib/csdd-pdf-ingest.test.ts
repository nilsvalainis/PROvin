import { describe, expect, it } from "vitest";
import { buildCsddFieldsFromPdfSources, mergeCsddPdfRawSources } from "@/lib/csdd-pdf-ingest";
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
    const gemini = "Marka BMW\nReģistrācijas numurs AB-123";
    const merged = mergeCsddPdfRawSources(pdf, gemini);
    expect(merged).toContain("Iepriekšējās reģistrācijas valsts");
    expect(merged).toContain("5.3.4.");
  });

  it("buildCsddFieldsFromPdfSources fills country and prev inspection from combined text", () => {
    const { fields } = buildCsddFieldsFromPdfSources({
      textHint: SAMPLE_RAW,
      geminiRaw: "",
    });
    expect(fields.previousRegistrationCountry).toBe("VĀCIJA");
    expect(fields.ownerCountLatvia).toBe("3");
    expect(previousInspectionBlockHasData(fields.prevInspectionBlock)).toBe(true);
    expect(fields.prevInspectionBlock.defects.some((d) => d.code === "5.3.4.")).toBe(true);
    expect(fields.technicalInspectionHistory.length).toBeGreaterThan(0);
  });
});
