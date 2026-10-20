import { describe, expect, it } from "vitest";
import { buildIrissScanFindCards, formatIrissScanBudgetDelta, irissScanFindBucket } from "@/lib/iriss-scan-finds";

describe("iriss scan finds", () => {
  it("maps match statuses to Jauni / Saglabāti / Neder", () => {
    expect(irissScanFindBucket("jauns")).toBe("new");
    expect(irissScanFindBucket("interesants")).toBe("saved");
    expect(irissScanFindBucket("noraidits")).toBe("reject");
  });

  it("prints budget vs price without a long dash", () => {
    expect(formatIrissScanBudgetDelta(10656, 9450)).toEqual({
      label: "Budžetā +1 206 €",
      ok: true,
    });
    expect(formatIrissScanBudgetDelta(8000, 9450).ok).toBe(false);
    expect(formatIrissScanBudgetDelta(null, 9450).label).toBe("");
    expect(formatIrissScanBudgetDelta(10656, 9450).label).not.toMatch(/\u2014|\u2013/);
  });

  it("joins scan matches to listing cards and ignores customer orders", () => {
    const cards = buildIrissScanFindCards({
      vehicles: [
        {
          id: "v1",
          title: "Volvo XC60 D5 AWD",
          year: "2013",
          mileageKm: 168000,
          powerKw: "158",
          platform: "auto1",
          countryCode: "de",
          detailUrl: "https://auto1.com/v1",
          priceCurrent: 9450,
          priceTotal: 13794,
        },
      ],
      entries: [
        { orderId: "scan:s1", listingId: "v1", status: "jauns", matchedAt: "2026-10-19T10:00:00.000Z" },
        { orderId: "cust-1", listingId: "v1", status: "jauns", matchedAt: "2026-10-19T11:00:00.000Z" },
      ],
      budgetsByScanId: { s1: 10656 },
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe("Volvo XC60 D5 AWD");
    expect(cards[0]?.scanId).toBe("s1");
    expect(cards[0]?.priceLabel).toBe("9 450 €");
    expect(cards[0]?.budgetLabel).toContain("Budžetā");
    expect(cards[0]?.spec).toContain("168 000 km");
    expect(cards[0]?.spec).toContain("kW");
  });
});
