import { describe, expect, it } from "vitest";
import { inferMissingMileageCountries, type UnifiedMileageRow } from "@/lib/unified-mileage";

function row(sourceOrder: number, date: string, country: string, extra: Partial<UnifiedMileageRow> = {}): UnifiedMileageRow {
  const [d, m, y] = date.split(".").map(Number);
  return {
    date,
    odometer: String(sourceOrder * 1000),
    country,
    sortableTime: Date.UTC(y!, m! - 1, d!),
    sourceOrder,
    sourceLabel: "OFICIĀLĀ DĪLERA DATI",
    ...extra,
  } as UnifiedMileageRow;
}

const countries = (rows: UnifiedMileageRow[]) => rows.map((r) => `${r.country}${r.countryInferred ? "*" : ""}`);

describe("valstu aizpilde nobraukuma rindām (18.11)", () => {
  it("aizpilda starp diviem vienas valsts rādījumiem un atzīmē kā secinātu", () => {
    const rows = [row(1, "10.01.2015", "Latvija"), row(2, "10.06.2015", "Nezināmā"), row(3, "10.01.2016", "Latvija")];
    expect(countries(inferMissingMileageCountries(rows))).toEqual(["Latvija", "Latvija*", "Latvija"]);
  });

  it("pāri valsts maiņai neaizpilda", () => {
    const rows = [row(1, "10.01.2015", "Vācija"), row(2, "10.06.2015", ""), row(3, "10.01.2016", "Latvija")];
    expect(countries(inferMissingMileageCountries(rows))).toEqual(["Vācija", "", "Latvija"]);
  });

  it("tajā pašā mēnesī ņem mēneša valsti", () => {
    const rows = [row(1, "01.07.2022", "Somija"), row(2, "05.07.2022", "Nezināmā")];
    expect(countries(inferMissingMileageCountries(rows))).toEqual(["Somija", "Somija*"]);
  });

  it("pirms pirmā un pēc pēdējā zināmā rādījuma neizdomā", () => {
    const rows = [row(1, "10.01.2014", ""), row(2, "10.01.2015", "Latvija"), row(3, "10.01.2017", "")];
    expect(countries(inferMissingMileageCountries(rows))).toEqual(["", "Latvija", ""]);
  });

  it("sludinājuma valsts nav pierādījums", () => {
    const rows = [
      row(1, "10.01.2015", "Latvija"),
      row(2, "10.06.2015", "Polija", { countryUnverified: true }),
      row(3, "10.07.2015", ""),
      row(4, "10.01.2016", "Latvija"),
    ];
    expect(countries(inferMissingMileageCountries(rows))[2]).toBe("Latvija*");
  });
});
