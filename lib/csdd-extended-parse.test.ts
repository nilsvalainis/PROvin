import { describe, expect, it } from "vitest";
import { applyCsddPasteToForm, backfillCsddExtendedFromRaw, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  extractFirstNextInspectionDateIso,
  parseDetailedRatingBlockFromRaw,
  parseIeprieksejasApskatesSection,
  parseIeprieksejasApskatesTaRow,
  parseOwnerRegistrationFromRaw,
  parsePreviousRegistrationCountry,
  parseTechnicalInspectionHistory,
} from "@/lib/csdd-extended-parse";
import {
  buildPreviousInspectionBlockHtml,
  buildTechnicalInspectionHistoryTableHtml,
} from "@/lib/csdd-inspection-history-html";
import { csddFormToPlainText } from "@/lib/admin-source-blocks";

const SAMPLE_RAW = `Iepriekšējās reģistrācijas valsts VĀCIJA
Transportlīdzekļa reģistrācija
 No 22/01/2016 3 īpašnieki
22.01.2016 - Pirmā reģistrācija Latvijā
22.02.2016 - Īpašnieka maiņa
20.01.2017 - Īpašnieka maiņa
Nobraukuma vēsture
Nobraukums, datums
274516 - 16.12.2025
Tehnisko apskašu vēsture
Apskates datums 16.12.2025
Apskates tips pamatpārbaude
Novērtējums 2 - Ar mēneša laikā labojamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
5.3.4. 2 Priekšējais tilts. Palielināta brīvkustība.
3.2. 1 Redzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.
Apskates datums 04.12.2024
Apskates tips atkārtota pārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
8.4.1. 1 Neveidojot piles, sūcas eļļa.
Apskates datums 27.01.2016
Apskates tips pamatpārbaude
Novērtējums 2 - Ar mēneša laikā labojamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
503 2 Nepietiekams riepu protektora dziļums.
Informācija sagatavota elektroniski 31.05.2026 11:56:58.`;

const FULL_CSDD_RAW = `Tehniskie dati
Pārbaudes veids:\tPamatpārbaude
Nākamās apskates datums:\t17.03.2027
Odometra rādījums:\t220831
Novērtējums:\t1 - Ar pieļaujamiem defektiem
Dūmainības koeficients (m-1):\t0.09

Detalizētais vērtējums
Kods\tNovērtējums:\tTrūkumi vai bojājumi
3.2.\t1\tRedzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.
6.2.1.\t1\tVirsbūves stiprību un citus satiksmes dalībniekus neapdraudoši korozijas bojājumi

Iepriekšējās apskates dati
Pārbaudes veids:\tPamatpārbaude
Nākamās apskates datums:\t15.01.2026
Odometra rādījums:\t274516
Novērtējums:\t2 - Ar mēneša laikā labojamiem defektiem
Dūmainības koeficients (m-1):\t0.58
Piezīmes:\tStāvbremzes bremzēšanas efektivitāte pietiekoša.
Kods\tNovērtējums:\tTrūkumi vai bojājumi
5.3.4.\t2\tPriekšējais tilts. Palielināta brīvkustība.
3.2.\t1\tRedzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.
Nobraukuma vēsture
274516 - 16.12.2025
Tehnisko apskašu vēsture
Apskates datums 04.12.2024
Apskates tips atkārtota pārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
8.4.1. 1 Neveidojot piles, sūcas eļļa.`;

describe("csdd extended parse", () => {
  it("parses previous registration country", () => {
    expect(parsePreviousRegistrationCountry(SAMPLE_RAW)).toBe("VĀCIJA");
  });

  it("parses owner count and change events", () => {
    const { ownerCount, events } = parseOwnerRegistrationFromRaw(SAMPLE_RAW);
    expect(ownerCount).toBe("3");
    expect(events).toHaveLength(3);
    expect(events[0]?.label).toMatch(/Pirmā reģistrācija/i);
  });

  it("parses technical inspection history with all defect rows", () => {
    const rows = parseTechnicalInspectionHistory(SAMPLE_RAW);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]?.date).toBe("16.12.2025");
    expect(rows[0]?.ratingLevel).toBe(2);
    expect(rows[0]?.defects).toHaveLength(2);
    expect(rows[0]?.defects[0]?.code).toBe("5.3.4.");
    expect(rows[0]?.defects[0]?.rating).toBe("2");
    const old2016 = rows.find((r) => r.date === "27.01.2016");
    expect(old2016?.defects[0]?.code).toBe("503");
  });

  it("applyCsddPasteToForm fills extended fields without breaking mileage", () => {
    const parsed = parseCsddPaste(SAMPLE_RAW);
    const form = applyCsddPasteToForm(emptyCsddFields(), SAMPLE_RAW, parsed);
    expect(form.previousRegistrationCountry).toBe("VĀCIJA");
    expect(form.ownerCountLatvia).toBe("3");
    expect(form.ownerRegistrationEvents.length).toBe(3);
    expect(form.technicalInspectionHistory.length).toBeGreaterThanOrEqual(3);
    expect(form.mileageHistory.some((r) => r.odometer === "274516")).toBe(true);
  });

  it("plain text for Gemini includes each defect line", () => {
    const parsed = parseCsddPaste(SAMPLE_RAW);
    const form = applyCsddPasteToForm(emptyCsddFields(), SAMPLE_RAW, parsed);
    const text = csddFormToPlainText(form);
    expect(text).toContain("Tehnisko apskašu vēsture");
    expect(text).toContain("5.3.4.");
    expect(text).toContain("Priekšējais tilts");
  });

  it("table HTML groups by year with defect rows", () => {
    const rows = parseTechnicalInspectionHistory(SAMPLE_RAW);
    const html = buildTechnicalInspectionHistoryTableHtml(rows);
    expect(html).toContain("2025");
    expect(html).toContain("pdf-csdd-ta-year-heading");
    expect(html).toContain("5.3.4.");
    expect(html).toContain("Trūkumi vai bojājumi");
    expect(html).toContain("mirror-table--csdd-defect");
  });

  it("parses Detalizētais vērtējums into admin prevInspectionBlock", () => {
    const block = parseDetailedRatingBlockFromRaw(FULL_CSDD_RAW);
    expect(block.inspectionType).toBe("Pamatpārbaude");
    expect(block.odometer).toBe("220831");
    expect(block.ratingLevel).toBe(1);
    expect(block.smokeCoefficient).toBe("0.09");
    expect(block.defects).toHaveLength(2);
    expect(block.defects[0]?.code).toBe("3.2.");
    expect(block.defects[1]?.code).toBe("6.2.1.");
    expect(block.nextInspectionDateText).toBe("");
  });

  it("parses Iepriekšējās apskates dati as newest TA history row", () => {
    const row = parseIeprieksejasApskatesTaRow(FULL_CSDD_RAW);
    expect(row?.date).toBe("16.12.2025");
    expect(row?.defects.some((d) => d.code === "5.3.4.")).toBe(true);
    const history = parseTechnicalInspectionHistory(FULL_CSDD_RAW);
    expect(history[0]?.date).toBe("16.12.2025");
    expect(history[0]?.defects.some((d) => d.code === "5.3.4.")).toBe(true);
  });

  it("uses first Nākamās apskates datums in raw, not Iepriekšējās section", () => {
    expect(extractFirstNextInspectionDateIso(FULL_CSDD_RAW)).toBe("2027-03-17");
    const parsed = parseCsddPaste(FULL_CSDD_RAW);
    const form = applyCsddPasteToForm(emptyCsddFields(), FULL_CSDD_RAW, parsed);
    expect(form.nextInspectionDate).toBe("2027-03-17");
  });

  it("applyCsddPasteToForm maps sections correctly", () => {
    const parsed = parseCsddPaste(FULL_CSDD_RAW);
    const form = applyCsddPasteToForm(emptyCsddFields(), FULL_CSDD_RAW, parsed);
    expect(form.prevInspectionBlock.defects[0]?.code).toBe("3.2.");
    expect(form.opacityCoefficient).toBe("0.09");
    const html = buildPreviousInspectionBlockHtml(form.prevInspectionBlock, "");
    expect(html).toContain("3.2.");
    expect(html).toContain("6.2.1.");
    expect(html).not.toContain("5.3.4.");
  });

  it("parses Iepriekšējās apskates section metadata", () => {
    const block = parseIeprieksejasApskatesSection(FULL_CSDD_RAW);
    expect(block.odometer).toBe("274516");
    expect(block.ratingLevel).toBe(2);
    expect(block.inspectionDateText).toBe("16.12.2025");
  });

  it("does not append registration metadata to last TA defect description", () => {
    const raw = `Tehnisko apskašu vēsture
Apskates datums 27.01.2016
Apskates tips pamatpārbaude
Novērtējums 2 - Ar mēneša laikā labojamiem defektiem
Dūmainības koeficients (m-1): 0.33
 Kods Novērtējums Trūkumi vai bojājumi
503 2 Nepietiekams riepu protektora dziļums.
607 2 Priekšējais tilts. Palielināta brīvkustība balsta šarnīrā. Kreisais apakšējais pakaļējais balsta šarnīrs.
407 1 Nevienmērīga stāvbremzes darbība. Iepriekšējās reģistrācijas valsts VĀCIJA Transportlīdzekļa reģistrācija No 22/01/2016 3 īpašnieki 22.01.2016 - Pirmā reģistrācija Latvijā 22.02.2016 - Īpašnieka maiņa 20.01.2017 - Īpašnieka maiņa Pēdējā tehniskā apskate TA datums 30.12.2025 Nākošā TA 12.01.2027 Odometra rādījums 274726`;

    const rows = parseTechnicalInspectionHistory(raw);
    const row2016 = rows.find((r) => r.date === "27.01.2016");
    const defect407 = row2016?.defects.find((d) => d.code === "407");
    expect(defect407?.description).toBe("Nevienmērīga stāvbremzes darbība");
    expect(defect407?.description).not.toMatch(/VĀCIJA|īpašniek/i);

    expect(parsePreviousRegistrationCountry(raw)).toBe("VĀCIJA");
    const { ownerCount, events } = parseOwnerRegistrationFromRaw(raw);
    expect(ownerCount).toBe("3");
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("backfill upgrades legacy rows without defects", () => {
    const parsed = parseCsddPaste(SAMPLE_RAW);
    const form = applyCsddPasteToForm(emptyCsddFields(), SAMPLE_RAW, parsed);
    const legacy = {
      ...form,
      technicalInspectionHistory: form.technicalInspectionHistory.map((r) => ({
        ...r,
        defects: [],
        smokeCoefficient: "",
        notes: "",
      })),
    };
    const backfilled = backfillCsddExtendedFromRaw(legacy);
    expect(backfilled.technicalInspectionHistory[0]?.defects.length).toBeGreaterThan(0);
  });
});
