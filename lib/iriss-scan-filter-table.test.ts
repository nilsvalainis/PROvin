import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanBudgetFromFilters, irissScanFilterTableRows } from "@/lib/iriss-scan-filter-table";

describe("iriss scan filter table", () => {
  it("offers Izveidot filtru when a source has no link", () => {
    const rec = emptyIrissScanRecord("id", "2026-10-19T17:58:00.000Z");
    rec.brandModel = "Volvo XC60";
    const rows = irissScanFilterTableRows(rec);
    const a1 = rows.find((r) => r.label === "Auto1");
    const mobile = rows.find((r) => r.label === "mobile.de");
    const as24 = rows.find((r) => r.label === "AutoScout24");
    expect(a1?.action).toBe("create");
    expect(a1?.status).toBe("-");
    expect(mobile?.description).toBe("Manuāli, maksas");
    expect(as24?.description).toBe("Nav filtra");
    expect(as24?.action).toBe("create");
  });

  it("opens an existing filter and describes it", () => {
    const rec = emptyIrissScanRecord("id", "2026-10-19T17:58:00.000Z");
    rec.brandModel = "Volvo";
    rec.listingLinkAuto1 = [
      "https://www.auto1.com/en/search?make=volvo&powerFrom=100&powerTo=130&priceTo=15000",
    ];
    const row = irissScanFilterTableRows(rec).find((r) => r.label === "Auto1");
    expect(row?.action).toBe("open");
    expect(row?.href).toContain("auto1.com");
    expect(row?.status).toMatch(/^OK /);
    expect(row?.description.toLowerCase()).toContain("volvo");
  });

  it("reads budget from filter priceTo", () => {
    const rec = emptyIrissScanRecord("id", "2026-10-19T17:58:00.000Z");
    rec.listingLinkAuto1 = ["https://www.auto1.com/en/search?priceTo=12000"];
    rec.listingLinkOpenline = ["https://www.openlane.eu/en/search?priceTo=15000"];
    expect(irissScanBudgetFromFilters(rec)).toBe(15000);
  });
});
