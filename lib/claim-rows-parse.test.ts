import { describe, expect, it } from "vitest";
import { filterClaimRowsForClientReport, type ClaimTableRow } from "@/lib/claim-rows-parse";

function row(partial: Partial<ClaimTableRow> & Pick<ClaimTableRow, "desc" | "descShort" | "amount">): ClaimTableRow {
  return {
    date: partial.date ?? "01.06.2020",
    iso: partial.iso ?? "LV",
    emphasize: partial.emphasize ?? false,
    desc: partial.desc,
    descShort: partial.descShort,
    amount: partial.amount,
  };
}

describe("filterClaimRowsForClientReport valuation vs loss", () => {
  it("drops vehicle Vērtība / market value EUR rows", () => {
    const rows = [
      row({
        desc: "01.06.2020 Vērtība 12 500 EUR Vācija",
        descShort: "Vērtība 12 500 EUR Vācija",
        amount: "12 500 EUR",
      }),
      row({
        desc: "15.08.2021 Tirgus vērtība 9800 EUR",
        descShort: "Tirgus vērtība 9800 EUR",
        amount: "9800 EUR",
      }),
    ];
    expect(filterClaimRowsForClientReport(rows)).toHaveLength(0);
  });

  it("keeps damage loss / zaudējumu apjoms amounts", () => {
    const rows = [
      row({
        desc: "01.06.2020 Transportlīdzekļa zaudējumu apjoms Summa 300 - 400 EUR Valsts Vācija",
        descShort: "zaudējumu apjoms Summa 300 - 400 EUR",
        amount: "300 - 400 EUR",
      }),
      row({
        desc: "Novērtējums Aptuvenā iepriekš gūto bojājumu vērtība 1 500 - 2 000 €",
        descShort: "bojājumu vērtība 1 500 - 2 000 €",
        amount: "1 500 - 2 000 €",
      }),
    ];
    expect(filterClaimRowsForClientReport(rows).length).toBeGreaterThanOrEqual(2);
  });
});
