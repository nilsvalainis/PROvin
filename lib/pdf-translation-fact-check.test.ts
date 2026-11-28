import { describe, expect, it } from "vitest";

import { checkTranslatedPdfTexts, extractLargeNumbers, extractNumericDates } from "@/lib/pdf-translation-fact-check";

const check = (lv: string, tr: string, lang: "en" | "ru" | "de" = "en") =>
  checkTranslatedPdfTexts({ lv: { "main.iriss": lv }, translated: { "main.iriss": tr }, lang });

describe("skaitļu un datumu izvilkšana", () => {
  it("km dažādos formātos, bez datumiem", () => {
    expect(extractLargeNumbers("120 000 km, 120,000 km, 120.000 km, 15.03.2020")).toEqual([120000, 120000, 120000]);
    expect(extractNumericDates("15.03.2020 un 2021-06-02").dates).toEqual(["2020-03-15", "2021-06-02"]);
  });
});

describe("tulkojums pret LV", () => {
  it("negatīvi: pareizs tulkojums - nav atzīmes (EN/RU/DE)", () => {
    const lv = "15.03.2020 nobraukums 120 000 km. Auto bija 3 īpašnieki un 1 negadījums.";
    expect(check(lv, "On 15.03.2020 the mileage was 120,000 km. The car had 3 owners and 1 accident.")).toEqual([]);
    expect(check(lv, "15.03.2020 пробег 120 000 км. У автомобиля было 3 владельца и 1 ДТП.", "ru")).toEqual([]);
    expect(check(lv, "Am 15.03.2020 betrug der Kilometerstand 120.000 km. Das Auto hatte 3 Halter und 1 Unfall.", "de")).toEqual([]);
  });
  it("negatīvi: skaitlis vārdiem un datums vārdiem", () => {
    expect(check("Auto bija 2 īpašnieki.", "The car had two owners.")).toEqual([]);
    expect(check("15.03.2020 veikta apkope.", "Service was carried out on 15 March 2020.")).toEqual([]);
  });
  it("negatīvi: īpašnieku maiņas nav īpašnieku skaits", () => {
    expect(check("3 īpašnieku maiņas, 4 īpašnieki.", "3 changes of ownership, 4 owners.")).toEqual([]);
  });
  it("pozitīvi: mainīts nobraukums - E", () => {
    const f = check("Nobraukums 120 000 km.", "Mileage 102,000 km.");
    expect(f.map((x) => [x.id, x.level])).toEqual([
      ["translation_number_added", "E"],
      ["translation_number_lost", "W"],
    ]);
  });
  it("pozitīvi: mainīts datums - E", () => {
    const f = check("15.03.2020 apskate.", "Inspection on 13.05.2020.");
    expect(f.map((x) => x.id)).toContain("translation_date_added");
  });
  it("pozitīvi: mainīts īpašnieku / negadījumu skaits - E", () => {
    expect(check("Auto bija 3 īpašnieki.", "The car had 4 owners.").map((x) => x.id)).toEqual(["translation_owners"]);
    expect(check("Fiksēti 2 negadījumi.", "Было зафиксировано 3 ДТП.", "ru").map((x) => x.id)).toEqual(["translation_incidents"]);
  });
  it("netulkots (tas pats teksts) vai tukšs - neko nepārbauda", () => {
    expect(check("120 000 km", "120 000 km")).toEqual([]);
    expect(check("120 000 km", "")).toEqual([]);
  });
});
