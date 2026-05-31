import { describe, expect, it } from "vitest";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  parseOwnerRegistrationFromRaw,
  parsePreviousRegistrationCountry,
  parseTechnicalInspectionHistory,
} from "@/lib/csdd-extended-parse";
import { buildTechnicalInspectionHistoryChartHtml } from "@/lib/csdd-history-charts";
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

  it("parses technical inspection history with severity levels", () => {
    const rows = parseTechnicalInspectionHistory(SAMPLE_RAW);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]?.date).toBe("16.12.2025");
    expect(rows[0]?.ratingLevel).toBe(2);
    expect(rows[0]?.maxDefectLevel).toBe(2);
    const old2016 = rows.find((r) => r.date === "27.01.2016");
    expect(old2016?.maxDefectLevel).toBe(2);
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

  it("plain text for Gemini includes TA history", () => {
    const parsed = parseCsddPaste(SAMPLE_RAW);
    const form = applyCsddPasteToForm(emptyCsddFields(), SAMPLE_RAW, parsed);
    const text = csddFormToPlainText(form);
    expect(text).toContain("Tehnisko apskašu vēsture");
    expect(text).toContain("16.12.2025");
    expect(text).toContain("Īpašnieku maiņas Latvijā");
  });

  it("chart HTML renders severity badges by year", () => {
    const rows = parseTechnicalInspectionHistory(SAMPLE_RAW);
    const html = buildTechnicalInspectionHistoryChartHtml(rows, { compact: true });
    expect(html).toContain("2025");
    expect(html).toContain("pdf-csdd-sev-badge");
  });
});
