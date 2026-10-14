import { describe, expect, it } from "vitest";
import {
  mergeListingOrderOvMigration,
  parseIrissListingOrderOv,
  setListingOrderOvLink,
} from "@/lib/iriss-listing-order-ov";

describe("parseIrissListingOrderOv", () => {
  it("keeps vehicle → order links and drops junk", () => {
    expect(parseIrissListingOrderOv({ a: ["ord-1", "ord-1", ""], b: [] })).toEqual({ a: ["ord-1"] });
    expect(parseIrissListingOrderOv(null)).toEqual({});
  });
});

describe("setListingOrderOvLink", () => {
  it("sets one order per vehicle and can clear without dropping other cars", () => {
    const a = setListingOrderOvLink({}, "car-1", "ord-1");
    expect(a).toEqual({ "car-1": ["ord-1"] });
    const b = setListingOrderOvLink(a, "car-2", "ord-2");
    expect(b).toEqual({ "car-1": ["ord-1"], "car-2": ["ord-2"] });
    expect(setListingOrderOvLink(b, "car-1", null)).toEqual({ "car-2": ["ord-2"] });
  });
});

describe("mergeListingOrderOvMigration", () => {
  it("uses the server when it already has links and keeps local only as a fallback seed", () => {
    expect(mergeListingOrderOvMigration({ a: ["s"] }, { a: ["l"], b: ["x"] })).toEqual({
      next: { a: ["s"] },
      persistServer: false,
    });
    expect(mergeListingOrderOvMigration({}, { a: ["l"] })).toEqual({
      next: { a: ["l"] },
      persistServer: true,
    });
    expect(mergeListingOrderOvMigration({}, {})).toEqual({ next: {}, persistServer: false });
  });
});
