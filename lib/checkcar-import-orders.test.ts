import { describe, expect, it } from "vitest";

import { autobidOriginalHint, pickLatestOrderForVin } from "@/lib/checkcar-import-orders";

const VIN = "VF1AAAAA012345678";

describe("pasūtījums pēc VIN", () => {
  it("ņem jaunāko; demo un konsultācijas izlaiž; melnrakstā labotais VIN ir noteicošais", () => {
    const rows = [
      { id: "cs_old", created: 100, vin: VIN },
      { id: "cs_new", created: 300, vin: VIN.toLowerCase() },
      { id: "cs_demo", created: 900, vin: VIN, isDemo: true },
      { id: "cs_select", created: 800, vin: VIN, checkoutLine: "provin_select" },
      { id: "cs_edited", created: 500, vin: "WVWZZZ1KZAW000001" },
      { id: "cs_moved", created: 700, vin: VIN },
    ];
    const index = [
      { sessionId: "cs_edited", vin: VIN },
      { sessionId: "cs_moved", vin: "WVWZZZ1KZAW000001" },
    ];
    expect(pickLatestOrderForVin(VIN, rows, index)).toBe("cs_edited");
    expect(pickLatestOrderForVin(VIN, rows, [])).toBe("cs_moved");
    expect(pickLatestOrderForVin("WBA0000000000000X", rows, index)).toBeNull();
    expect(pickLatestOrderForVin("short", rows, index)).toBeNull();
  });
});

describe("Autobid oriģinālās bildes", () => {
  it("skaita Autobid novērojumus un bildes (arī TheCarApi ar Autobid platformu)", () => {
    const hint = autobidOriginalHint({
      vin: VIN,
      updatedAt: "2026-11-27",
      observations: [
        { date: "2025-03-10", source: "autobid", km: 187300, auctionId: "A1", photos: [{ id: "p1" }, { id: "p2" }] },
        { date: "2025-03-14", source: "thecarapi", km: 187300, platform: "Autobid", photos: [{ id: "p3" }] },
        { date: "2024-01-01", source: "order", km: 150000 },
      ],
    });
    expect(hint).toEqual({ lots: 2, photos: 3, lastDate: "2025-03-14", auctionId: "A1" });
    expect(autobidOriginalHint({ vin: VIN, updatedAt: "", observations: [{ date: "2024-01-01", source: "order", km: 1 }] })).toBeNull();
    expect(autobidOriginalHint(null)).toBeNull();
  });
});
