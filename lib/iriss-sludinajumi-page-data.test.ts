import { describe, expect, it } from "vitest";
import { splitGoneListingVehicles } from "@/lib/iriss-sludinajumi-page-data";

const v = (id: string, change: "new" | "unchanged" | "gone", orderIds: string[] = []) => ({ id, change, orderIds });

describe("splitGoneListingVehicles", () => {
  it("atdala pazudušos un skaita tos pa datu kopumiem", () => {
    const { active, gone, goneCounts } = splitGoneListingVehicles(
      [v("a", "new", ["o1"]), v("b", "gone", ["o1"]), v("c", "gone", ["scan:s1"]), v("d", "gone"), v("e", "unchanged")],
      { orderOv: {}, matchOrderIds: {} },
    );
    expect(active.map((x) => x.id)).toEqual(["a", "e"]);
    expect(gone.map((x) => x.id)).toEqual(["b", "c", "d"]);
    expect(goneCounts).toEqual({ orders: 2, scan: 1 });
  });

  it("ņem vērā ar roku piesaistīto un atbilstības pasūtījumus", () => {
    const { goneCounts } = splitGoneListingVehicles([v("b", "gone", ["o1"]), v("c", "gone")], {
      orderOv: { b: ["scan:s2"] },
      matchOrderIds: { c: ["scan:s3"] },
    });
    expect(goneCounts).toEqual({ orders: 0, scan: 2 });
  });
});
