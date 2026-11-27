import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import {
  buildOilIntervalSeriesForBlock,
  oilExceededIntervalsForBlock,
  oilRowsFromServiceWorks,
} from "@/lib/oil-change-interval-chart";
import {
  buildOilChangeIntervalPdfHtml,
  isEngineOilChangeWork,
  isPossibleOilChangeWork,
} from "@/lib/oil-change-intervals";
import {
  ensureOilIntervalNotes,
  oilPossibleChangeNote,
  oilPossibleChangeNotePresent,
} from "@/lib/oil-interval-dealer-notes";
import { possibleOilPromptLines } from "@/lib/engine-oil-prompt-list";

const r = (date: string, odometer: string, works: string): AutoRecordsServiceWorkRow => ({
  date,
  odometer,
  location: "",
  works,
});

/** BMW X3 G01 WBATR51040LF73027 (BF 27.11): dīlera rindas 2024-2025 kā melnrakstā. */
const X3_ROWS: AutoRecordsServiceWorkRow[] = [
  r("31.07.2025", "141511", "Bremžu šķidruma maiņa\nStandarta apjoms"),
  r("24.07.2025", "140919", "Bremžu šķidrums DOT4 LV, zemas viskozitātes (83132184843)\nAntifrīzs 1L (ANTI)"),
  r(
    "04.04.2025",
    "136882",
    "Eļļas filtra korpuss (11428596283)\nDegvielas tvertnes ventilācijas caurule (13907645858)\nRadiatora šļūtene (17125A022D6)\nAntifrīzs HT-12 1L (ANTI HT12)",
  ),
  r("12.03.2025", "135583", "Motoreļļas maiņa\nSalona filtra maiņa\nStandarta apjoms"),
  r("12.02.2025", "133836", "Priekšējās bremzes\nStandarta apjoms"),
  r("04.10.2024", "126477", "Apkope"),
  r("06.03.2024", "111604", "Motoreļļas maiņa\nGaisa filtra maiņa\nSalona filtra maiņa"),
];

function x3Block() {
  const block = emptyAutoRecordsBlock();
  block.serviceWorks = X3_ROWS;
  return block;
}

describe("Eļļas filtra korpuss = iespējama, nepierādīta eļļas maiņa (Nils 27.11, S8)", () => {
  it("atpazīšana LV / EN / RU / DE; ar skaidru eļļas maiņu ierakstā - pierādīta", () => {
    for (const t of [
      "Eļļas filtra korpuss (11428596283)",
      "Eļļas filtra korpusa blīve",
      "Ölfiltergehäuse ersetzen",
      "Oil filter housing replaced",
      "Замена корпуса масляного фильтра",
    ]) {
      expect(isEngineOilChangeWork(t), t).toBe(false);
      expect(isPossibleOilChangeWork(t), t).toBe(true);
    }
    for (const t of [
      "Motoreļļas maiņa\nEļļas filtra korpuss",
      "Motoröl und Ölfilter wechseln, Ölfiltergehäuse ersetzen",
      "Oil filter housing, engine oil 5W30",
    ]) {
      expect(isEngineOilChangeWork(t), t).toBe(true);
      expect(isPossibleOilChangeWork(t), t).toBe(false);
    }
    expect(isEngineOilChangeWork("Eļļas un eļļas filtra maiņa")).toBe(true);
    expect(isPossibleOilChangeWork("Salona filtra korpusa tīrīšana")).toBe(false);
  });

  it("X3 WBATR51040LF73027: pēdējā pierādītā maiņa 12.03.2025, 04.04.2025 korpuss - tikai «iespējama»", () => {
    const series = buildOilIntervalSeriesForBlock(x3Block(), { nowMs: Date.UTC(2025, 7, 1) });
    expect(series.points.map((p) => p.date)).toEqual(["06.03.2024", "12.03.2025"]);
    expect(series.changeCount).toBe(2);
    expect(series.possiblePoints).toEqual([{ date: "04.04.2025", odometer: "136882", km: 136882 }]);
    // Intervāls skaitās tikai starp pierādītajām maiņām.
    expect(series.points[1]?.intervalKm).toBe(135583 - 111604);
  });

  it("tabulā (PDF + admina priekšskatījums) korpuss ir atsevišķa rinda «Iespējama» starp maiņām pēc datuma", () => {
    const html = buildOilChangeIntervalPdfHtml(buildOilIntervalSeriesForBlock(x3Block()));
    expect(html).toContain("pdf-oil-int__row--possible");
    expect(html).toContain("Iespējama");
    expect(html).toContain("iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts");
    expect(html.indexOf("12.03.2025")).toBeLessThan(html.indexOf("04.04.2025"));
    expect(html).toContain("<b>2</b><span>fiksētas maiņas</span>");
  });

  it("importētās rindas satur arī iespējamo (ar oriģinālo tekstu), hronoloģiski", () => {
    const rows = oilRowsFromServiceWorks(x3Block());
    expect(rows.map((x) => x.date)).toEqual(["06.03.2024", "12.03.2025", "04.04.2025"]);
    expect(rows[2]?.works).toContain("Eļļas filtra korpuss");
  });

  it("pārsniegumu korpuss NEaizver: periods paliek pārsniegts, 3. piebilde nosauc datumu", () => {
    const block = emptyAutoRecordsBlock();
    block.oilIntervalChart = { rows: [], oemKm: 15_000, oemMonths: 12, highlightOverOem: true, useSavedRows: false };
    block.serviceWorks = [
      r("01.03.2022", "60000", "Motoreļļas maiņa"),
      r("01.09.2022", "70000", "Eļļas filtra korpuss (11428596283)"),
      r("01.06.2023", "85000", "Motoreļļas maiņa"),
    ];
    const series = buildOilIntervalSeriesForBlock(block);
    expect(series.points.map((p) => p.intervalKm)).toEqual([null, 25000]);
    const intervals = oilExceededIntervalsForBlock(block);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({ fromDate: "01.03.2022", toDate: "01.06.2023", possibleDates: ["01.09.2022"] });

    const text = "Intervāls 25 000 km pārsniedz ražotāja intervālu (15 000 km).";
    const out = ensureOilIntervalNotes(text, intervals, "lv");
    expect(out).toContain(oilPossibleChangeNote("lv", ["01.09.2022"]));
    expect(out.match(/nav pierādīts/g)).toHaveLength(1);
    expect(out).toContain("Tas nenozīmē, ka eļļas maiņa nav veikta");
    // Atkārtota palaišana nedublē.
    expect(ensureOilIntervalNotes(out, intervals, "lv")).toBe(out);
  });

  it("3. piebilde visās valodās un tās atpazīšana", () => {
    const d = ["04.04.2025"];
    expect(oilPossibleChangeNote("lv", d)).toBe(
      "Šajā periodā ir arī eļļas filtra korpusa maiņa (04.04.2025) - iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts.",
    );
    expect(oilPossibleChangeNote("en", d)).toContain("oil filter housing replacement (04.04.2025) - an oil change may also have been done, but this is not proven.");
    expect(oilPossibleChangeNote("ru", d)).toContain("корпуса масляного фильтра (04.04.2025)");
    expect(oilPossibleChangeNote("de", d)).toContain("Ölfiltergehäuses (04.04.2025)");
    for (const lang of ["lv", "en", "ru", "de"] as const) {
      const note = oilPossibleChangeNote(lang, d);
      expect(oilPossibleChangeNotePresent(note), lang).toBe(true);
      expect(note).not.toMatch(/[—–]/);
      expect(note).not.toMatch(/soļ|solis/);
    }
  });

  it("AI faktos: iespējamās maiņas atsevišķi, ar aizliegumu tās skaitīt", () => {
    const lines = possibleOilPromptLines([{ date: "04.04.2025", odometer: "136882" }]);
    expect(lines).toContain("I1: 04.04.2025, 136 882 km - eļļas filtra korpuss");
    expect(lines).toContain("NAV pierādītas");
    expect(possibleOilPromptLines([])).toBe("");
  });
});
