import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { buildCsddFieldsFromPdfSources } from "@/lib/csdd-pdf-ingest";
import { isLikelyCsddPdfText, mergeCsddFieldsFillEmpty } from "@/lib/admin-copilot-csdd";
import { previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";

/** Fragments from CSDD e.csdd PDF (HB5743-style layout). */
const HB5743_CSDD_RAW = `Reģistrācijas dati
Reģistrācijas numurs HB5743
Statuss Uzskaitē
Marka Modelis HONDA CR-V
Pilna masa (kg) 1930
Pašmasa (kg) 1529
Degviela Benzīns
VIN SHSRD87204U214216
Iepriekšējās reģistrācijas valsts FRANCIJA
Transportlīdzekļa reģistrācija
No 29/03/2008 3 īpašnieki
29.03.2008 - Pirmā reģistrācija Latvijā
Pēdējā tehniskā apskate
TA datums 30.07.2026
Nākošā TA 30.07.2027
Odometra rādījums 133562
Nobraukuma vēsture
133249 - 31.07.2025
132699 - 09.07.2024
Tehnisko apskašu vēsture
Apskates datums 31.07.2025
Apskates tips pamatpārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
Kods Novērtējums Trūkumi vai bojājumi
8.4.1. 1 Neveidojot piles, sūcas eļļa no motora (transmisijas).
Apskates datums 09.07.2024
Apskates tips pamatpārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
Informācija sagatavota elektroniski 05.08.2026 12:45:56.
Powered by TCPDF (www.tcpdf.org)`;

describe("admin-copilot-csdd", () => {
  it("detects CSDD e.csdd PDF text", () => {
    expect(isLikelyCsddPdfText(HB5743_CSDD_RAW)).toBe(true);
    expect(isLikelyCsddPdfText("AutoDNA report only")).toBe(false);
  });

  it("mergeCsddFieldsFillEmpty fills empty CSDD from HB5743-style parse", () => {
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: HB5743_CSDD_RAW, aiRaw: "" });
    const merged = mergeCsddFieldsFillEmpty(emptyCsddFields(), fields, HB5743_CSDD_RAW);
    expect(merged.registrationNumber).toBe("HB5743");
    expect(merged.makeModel).toContain("HONDA");
    expect(merged.previousRegistrationCountry).toMatch(/FRANCIJA/i);
    expect(merged.mileageHistory.some((r) => r.odometer.includes("133249"))).toBe(true);
    expect(merged.technicalInspectionHistory.length).toBeGreaterThan(0);
    expect(previousInspectionBlockHasData(merged.prevInspectionBlock) || merged.nextInspectionDate.trim()).toBeTruthy();
    expect(merged.rawUnprocessedData).toContain("Tehnisko apskašu vēsture");
  });

  it("does not overwrite existing CSDD scalar fields", () => {
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: HB5743_CSDD_RAW, aiRaw: "" });
    const existing = { ...emptyCsddFields(), registrationNumber: "KG982", comments: "Eksperta piezīme" };
    const merged = mergeCsddFieldsFillEmpty(existing, fields, HB5743_CSDD_RAW);
    expect(merged.registrationNumber).toBe("KG982");
    expect(merged.comments).toBe("Eksperta piezīme");
    expect(merged.makeModel).toContain("HONDA");
  });
});
