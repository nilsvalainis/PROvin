import { describe, expect, it } from "vitest";

import {
  autobidOriginalHint,
  orderTargetsForVin,
  pickCheckcarTarget,
  pickLatestOrderForVin,
  quickEvalCheckcarPhotoSession,
  quickEvalTargetsForVin,
} from "@/lib/checkcar-import-orders";

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

describe("mērķis: pasūtījums vai ātrais vērtējums", () => {
  const orders = orderTargetsForVin(VIN, [{ id: "cs_a", created: 1_764_000_000, vin: VIN }], []);
  const quick = quickEvalTargetsForVin(VIN, [
    { peekId: "8e51f2ea-0000-4000-8000-000000000001", createdAt: "2026-11-27T10:00:00.000Z", vin: VIN },
    { peekId: "8e51f2ea-0000-4000-8000-000000000002", createdAt: "2026-11-27T11:00:00.000Z", vin: "WVWZZZ1KZAW000001" },
  ]);

  it("ja ir tikai ātrais vērtējums - tas; ja abi - jaunākais pēc laika, pārējie ir alternatīvas", () => {
    expect(pickCheckcarTarget(quick).target).toMatchObject({ kind: "quick_eval", id: "8e51f2ea-0000-4000-8000-000000000001" });
    const both = pickCheckcarTarget([...orders, ...quick]);
    expect(both.target?.kind).toBe("quick_eval");
    expect(both.alternatives.map((a) => a.id)).toEqual(["cs_a"]);
  });

  it("atvērtās lapas norāde uzvar, ja tai ir šis VIN; sveša norāde tiek ignorēta", () => {
    expect(pickCheckcarTarget([...orders, ...quick], { kind: "order", id: "cs_a" }).target?.id).toBe("cs_a");
    expect(pickCheckcarTarget([...orders, ...quick], { kind: "order", id: "cs_cits" }).target?.kind).toBe("quick_eval");
    expect(pickCheckcarTarget([]).target).toBeNull();
  });

  it("ātrā vērtējuma foto krātuves sesija ir droša (bez defisēm)", () => {
    expect(quickEvalCheckcarPhotoSession("8E51F2EA-4199-4af1-93f0-b6c3530b4904")).toBe("qe_8e51f2ea41994af193f0b6c3530b4904");
    expect(quickEvalCheckcarPhotoSession("8e51f2ea-4199-4af1-93f0-b6c3530b4904")).toMatch(/^qe_[a-f0-9]{32}$/);
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
