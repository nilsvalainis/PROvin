import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";
import { buildCsddFieldsFromPdfSources, csddTextLayerNeedsAiFallback } from "@/lib/csdd-pdf-ingest";
import {
  applyCsddPdfToEmptyFields,
  isLikelyCsddPdfText,
  mergeCsddFieldsFillEmpty,
  selectCopilotClientPatch,
} from "@/lib/admin-copilot-csdd";
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

/** e.csdd.lv TCPDF, kur īpašnieki un valsts nav klasiskajā „N īpašnieki” / „Iepriekšējās” rindā. */
const NE6693_CSDD_RAW = `Reģistrācijas numursNE6693
StatussUzskaitē
Marka ModelisVOLKSWAGEN GOLF
VINWVWZZZ1KZAW123456
Iepriekšējā reģistrācijas valstsLIETUVA
Reģistrācija Latvijā
Īpašnieku skaitsLatvijā2
14.03.2018 - Pirmā reģistrācija Latvijā
11.06.2019 - Īpašnieka maiņa
Pēdējā tehniskā apskate
TA datums02.09.2025
Nākošā TA02.09.2026
Odometra rādījums148220
Novērtējums1 - Ar pieļaujamiem defektiem
Nobraukuma vēsture
148100- 02.09.2025
141200- 03.09.2024
Tehnisko apskašu vēsture
Apskates datums02.09.2025
Apskates tipspamatpārbaude
Novērtējums1 - Ar pieļaujamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
4.1.1.1Stūres mehānisms. Palielināta brīvkustība.
Iepriekšējās apskates dati
Pārbaudes veids: Pamatpārbaude
Odometra rādījums: 148100
Novērtējums: 1 - Ar pieļaujamiem defektiem
Kods Novērtējums: Trūkumi vai bojājumi
4.1.1. 1 Stūres mehānisms. Palielināta brīvkustība.
Informācija sagatavota elektroniski 02.11.2026 14:40:00.`;

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

  it("NE6693 TCPDF aizpilda īpašniekus, valsti, apskati, TA un nobraukumu tukšajos laukos", () => {
    const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({
      textHint: NE6693_CSDD_RAW,
      aiRaw: "",
    });
    const applied = applyCsddPdfToEmptyFields(emptyCsddFields(), fields, rawUnprocessedData, "NE6693.pdf");
    expect(applied.block.ownerCountLatvia).toBe("2");
    expect(applied.block.previousRegistrationCountry).toMatch(/LIETUVA/i);
    expect(applied.block.ownerRegistrationEvents.length).toBeGreaterThanOrEqual(2);
    expect(applied.block.mileageHistory.some((row) => row.odometer.includes("148100"))).toBe(true);
    expect(applied.block.technicalInspectionHistory.some((row) => row.date === "02.09.2025")).toBe(true);
    expect(previousInspectionBlockHasData(applied.block.prevInspectionBlock)).toBe(true);
    expect(applied.missingCritical).toEqual([]);
    expect(csddTextLayerNeedsAiFallback(applied.block, rawUnprocessedData)).toBe(false);
    expect(applied.note).toMatch(/aizpildīti tukšie lauki/);
    expect(applied.note).toMatch(/īpašnieku skaits \(2\)/);
    expect(applied.note).toMatch(/iepriekšējās reģistrācijas valsts \(LIETUVA\)/);
    expect(applied.note).toMatch(/apskates dati/);
    expect(applied.note).toMatch(/TA vēsture/);
    expect(applied.note).toMatch(/nobraukums/);
    expect(applied.note).not.toMatch(/[–—]/);
    expect(applied.changed).toBe(true);

    const blocks = createDefaultSourceBlocks();
    blocks.csdd = applied.block;
    const preview = selectCopilotClientPatch({
      applyMode: "preview",
      autoAppliedCount: 0,
      changedKeys: ["csdd"],
      workingBlocks: blocks,
      deterministicPatches: { csdd: applied.block },
    });
    expect(preview.changedKeys).toEqual(["csdd"]);
    expect(preview.patchedSourceBlocks.csdd?.ownerCountLatvia).toBe("2");
    expect(preview.patchedSourceBlocks.csdd?.previousRegistrationCountry).toMatch(/LIETUVA/i);
  });

  it("nesaka aizpildīti, ja kritiskie lauki pēc merge paliek tukši", () => {
    const raw = `Nobraukuma vēsture
148100 - 02.09.2025
Īpašnieku skaits nav norādīts skaitlī
Tehnisko apskašu vēsture
Apskates datums 02.09.2025
Informācija sagatavota elektroniski 02.11.2026 14:40:00.`;
    const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({ textHint: raw, aiRaw: "" });
    const applied = applyCsddPdfToEmptyFields(emptyCsddFields(), fields, rawUnprocessedData, "NE6693.pdf");
    expect(applied.block.ownerCountLatvia).toBe("");
    expect(applied.missingCritical).toContain("īpašnieku skaits");
    expect(applied.note).not.toMatch(/aizpildīti tukšie lauki/);
    expect(applied.note).toMatch(/Nav nolasīts: .*īpašnieku skaits/);
    expect(applied.note).not.toMatch(/[–—]/);
  });

  it("nesaka aizpildīti, ja neviens tukšs lauks nemainījās", () => {
    const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({
      textHint: NE6693_CSDD_RAW,
      aiRaw: "",
    });
    const first = applyCsddPdfToEmptyFields(emptyCsddFields(), fields, rawUnprocessedData, "NE6693.pdf");
    const again = applyCsddPdfToEmptyFields(first.block, fields, rawUnprocessedData, "NE6693.pdf");
    expect(again.writtenLabels.filter((label) => label !== "neapstrādātais teksts")).toEqual([]);
    expect(again.note).not.toMatch(/aizpildīti tukšie lauki/);
    expect(again.block.ownerCountLatvia).toBe("2");
    expect(again.block.registrationNumber === "NE6693" || again.block.makeModel.length > 0).toBe(true);
  });

  it("preview bez CSDD ielāpa neatgriež AI izmaiņas", () => {
    const blocks = createDefaultSourceBlocks();
    const preview = selectCopilotClientPatch({
      applyMode: "preview",
      autoAppliedCount: 1,
      changedKeys: ["autodna"],
      workingBlocks: blocks,
      deterministicPatches: {},
    });
    expect(preview.changedKeys).toEqual([]);
    expect(preview.patchedSourceBlocks).toEqual({});
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
