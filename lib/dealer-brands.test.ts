import { describe, expect, it } from "vitest";
import {
  groupTp5DealerBrands,
  TP5_DEALER_BRAND_GROUPS,
  TP5_DEALER_BRAND_LOGO_SRC,
  TP5_DEALER_BRANDS,
} from "@/lib/dealer-brands";
import { existsSync } from "node:fs";
import path from "node:path";

describe("dealer brands", () => {
  it("keeps 48 brands in the requested manufacturer groups", () => {
    expect(TP5_DEALER_BRAND_GROUPS).toHaveLength(12);
    expect(TP5_DEALER_BRANDS).toHaveLength(48);
    expect(TP5_DEALER_BRAND_GROUPS[0]).toEqual(["BMW", "MINI", "Rolls-Royce"]);
    expect(TP5_DEALER_BRAND_GROUPS[2]).toContain("CUPRA");
    expect(TP5_DEALER_BRAND_GROUPS[2]).toContain("Porsche");
    expect(TP5_DEALER_BRANDS.filter((b, i, arr) => arr.indexOf(b) !== i)).toEqual([]);
  });

  it("has a logo file for every brand", () => {
    const root = path.join(process.cwd(), "public");
    for (const brand of TP5_DEALER_BRANDS) {
      const src = TP5_DEALER_BRAND_LOGO_SRC[brand].split("?")[0]!;
      expect(existsSync(path.join(root, src.replace(/^\//, ""))), brand).toBe(true);
    }
  });

  it("groups a subset while preserving order", () => {
    expect(groupTp5DealerBrands(["Audi", "BMW", "Toyota", "Unknown"])).toEqual([
      ["BMW"],
      ["Audi"],
      ["Toyota"],
      ["Unknown"],
    ]);
  });
});
