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
  it("Radara «Jauni» ietver arī saišu auto bez atbilstības ieraksta (36 h logs), bez pazudušajiem", () => {
    const now = Date.parse("2026-10-27T01:00:00Z");
    const cards = buildIrissScanFindCards({
      vehicles: [
        { id: "fresh", title: "Lexus RX", orderIds: ["scan:s1"], firstSeenAt: "2026-10-26T17:57:00Z" },
        { id: "old", title: "Toyota", orderIds: ["scan:s1"], firstSeenAt: "2026-10-20T09:00:00Z" },
        { id: "gone", title: "Lexus NX", orderIds: ["scan:s1"], firstSeenAt: "2026-10-26T17:57:00Z", change: "gone" },
        { id: "saved", title: "Lexus UX", orderIds: ["scan:s1"], firstSeenAt: "2026-10-26T17:57:00Z" },
        { id: "client", title: "Volvo", orderIds: ["o1"], firstSeenAt: "2026-10-26T17:57:00Z" },
      ],
      entries: [{ orderId: "scan:s1", listingId: "saved", status: "interesants", matchedAt: "2026-10-26T18:00:00Z" }],
      nowMs: now,
    });
    expect(cards.map((c) => [c.listingId, c.bucket])).toEqual([
      ["saved", "saved"],
      ["fresh", "new"],
    ]);
  });

  it("bez nowMs - tikai atbilstību ieraksti (kā agrāk)", () => {
    const cards = buildIrissScanFindCards({
      vehicles: [{ id: "fresh", orderIds: ["scan:s1"], firstSeenAt: "2026-10-26T17:57:00Z" }],
      entries: [],
    });
    expect(cards).toEqual([]);
  });
  it("eCarsTrade bez solījuma rāda aplēsi, nevis «Nav cenas»", () => {
    const cards = buildIrissScanFindCards({
      vehicles: [{ id: "et", platform: "ecarstrade", orderIds: ["scan:s1"], priceCurrent: null, priceEstimate: 14300 }],
      entries: [{ orderId: "scan:s1", listingId: "et", status: "jauns", matchedAt: "2026-10-26T18:00:00Z" }],
    });
    expect(cards[0]?.priceLabel).toBe("14 300 €");
  });
});
