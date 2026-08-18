import { describe, expect, it } from "vitest";

import { mergeVendorServiceEntries, type VendorServiceEntry } from "@/lib/vendor-service-history";

function entry(works: string[]): VendorServiceEntry {
  return {
    date: "08.01.2025",
    odometer: "155000",
    country: "Vācija",
    category: "",
    location: "Bonn",
    works,
  };
}

describe("servisa ierakstu apvienošana", () => {
  it("ņem latvisko darbu sarakstu, nejaucot to ar angļu dublikātiem", () => {
    const merged = mergeVendorServiceEntries(
      [entry(["Unknown hex housing bracket", "Eļļas filtra komplekts"])],
      [entry(["Korpusa kronšteins", "Eļļas filtra komplekts"])],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.works).toEqual(["Korpusa kronšteins", "Eļļas filtra komplekts"]);
    expect(merged[0]?.works.join(" ")).not.toMatch(/hex housing/i);
  });
});
