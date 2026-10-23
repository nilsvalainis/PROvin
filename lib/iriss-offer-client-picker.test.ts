import { describe, expect, it } from "vitest";
import { filterIrissOfferClientOptions, irissOfferClientOptions } from "@/lib/iriss-offer-client-picker";

const row = (o: Partial<Parameters<typeof irissOfferClientOptions>[0][number]>) => ({
  id: "a",
  deletedAt: undefined,
  clientFirstName: "",
  clientLastName: "",
  phone: "",
  brandModel: "",
  totalBudget: "",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...o,
});

describe("irissOfferClientOptions", () => {
  const rows = [
    row({ id: "1", clientFirstName: "Jānis", clientLastName: "Bērziņš", brandModel: "BMW 3 Touring", totalBudget: "25000", updatedAt: "2026-10-20T00:00:00.000Z" }),
    row({ id: "2", clientFirstName: "Ilze", clientLastName: "Bērziņa", brandModel: "Audi A4 Avant", totalBudget: "22 000", phone: "+371 2000 0000", updatedAt: "2026-10-22T00:00:00.000Z" }),
    row({ id: "3", clientFirstName: "Dzēsts", deletedAt: "2026-10-01T00:00:00.000Z" }),
    row({ id: "4" }),
    row({ id: "5", phone: "29999999", totalBudget: "ap. 20k" }),
  ];

  it("lists each order separately, newest first, without deleted or nameless ones", () => {
    const out = irissOfferClientOptions(rows);
    expect(out.map((o) => o.orderId)).toEqual(["2", "1", "5"]);
    expect(out[1]).toMatchObject({ name: "Jānis Bērziņš", sub: "BMW 3 Touring · līdz 25 000 €" });
    expect(out[0]?.sub).toBe("Audi A4 Avant · līdz 22 000 €");
    expect(out[2]).toMatchObject({ name: "29999999", sub: "līdz ap. 20k" });
  });

  it("searches by name without diacritics, phone digits and car", () => {
    const out = irissOfferClientOptions(rows);
    expect(filterIrissOfferClientOptions(out, "berzin").map((o) => o.orderId)).toEqual(["2", "1"]);
    expect(filterIrissOfferClientOptions(out, "Bērziņš").map((o) => o.orderId)).toEqual(["1"]);
    expect(filterIrissOfferClientOptions(out, "20000000").map((o) => o.orderId)).toEqual(["2"]);
    expect(filterIrissOfferClientOptions(out, "audi ilze").map((o) => o.orderId)).toEqual(["2"]);
    expect(filterIrissOfferClientOptions(out, "  ")).toHaveLength(3);
  });
});
