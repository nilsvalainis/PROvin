import { describe, expect, it } from "vitest";
import { filterPartnerArchiveRows } from "@/lib/b2b-partner-archive-search";
import type { B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";

function row(partial: Partial<B2bPartnerOrderRow> & Pick<B2bPartnerOrderRow, "id" | "vin" | "createdAt">): B2bPartnerOrderRow {
  return {
    invoiceNumber: "-",
    amountLabel: "19,99 €",
    plan: "dealer",
    kind: "order",
    status: "ready",
    reportHref: `/api/partner/report/${partial.id}`,
    ...partial,
  };
}

const rows = [
  row({
    id: "o1",
    vin: "WVWZZZ3HZHE703058",
    createdAt: "2026-10-01T10:00:00.000Z",
    walletProduct: "dealer_raw",
  }),
  row({
    id: "o2",
    vin: "WBA8E9C50GK123456",
    createdAt: "2026-10-15T10:00:00.000Z",
    walletProduct: "business",
    plan: "business",
  }),
  row({
    id: "o3",
    vin: "YV1MZ84BDK2123456",
    createdAt: "2026-09-20T10:00:00.000Z",
    walletProduct: "dealer_pro",
  }),
];

describe("partner archive search", () => {
  it("filters by VIN fragment, product and date range", () => {
    expect(filterPartnerArchiveRows(rows, { vin: "3hzhe", dateFrom: "", dateTo: "", product: "" }).map((r) => r.id)).toEqual([
      "o1",
    ]);
    expect(filterPartnerArchiveRows(rows, { vin: "", dateFrom: "", dateTo: "", product: "business" }).map((r) => r.id)).toEqual([
      "o2",
    ]);
    expect(
      filterPartnerArchiveRows(rows, { vin: "", dateFrom: "2026-10-01", dateTo: "2026-10-31", product: "" }).map((r) => r.id),
    ).toEqual(["o1", "o2"]);
    expect(
      filterPartnerArchiveRows(rows, { vin: "WBA", dateFrom: "2026-10-01", dateTo: "2026-10-31", product: "dealer_raw" }),
    ).toEqual([]);
  });

  it("keeps report href so earlier reports can be downloaded again", () => {
    const hit = filterPartnerArchiveRows(rows, { vin: "WVW", dateFrom: "", dateTo: "", product: "dealer_raw" })[0];
    expect(hit?.reportHref).toBe("/api/partner/report/o1");
  });
});
