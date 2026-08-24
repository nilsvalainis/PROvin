import { describe, expect, it } from "vitest";

import {
  KEY_READ_HISTORY_LABEL,
  lifecycleDealerVisitTitle,
  looksLikeIntervalMaintenanceWorks,
  mergeVendorServiceEntries,
  type VendorServiceEntry,
} from "@/lib/vendor-service-history";

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

describe("dīlera vizītes virsraksts vēstures kopsavilkumā", () => {
  it("keeps interval jobs as Apkope and Key Read off that label", () => {
    expect(lifecycleDealerVisitTitle("Eļļas maiņa, filtri")).toBe("Apkope");
    expect(lifecycleDealerVisitTitle("Regulārā apkope")).toBe("Apkope");
    expect(looksLikeIntervalMaintenanceWorks(KEY_READ_HISTORY_LABEL)).toBe(false);
    expect(lifecycleDealerVisitTitle(KEY_READ_HISTORY_LABEL)).toBe("Dīlera nolasījums");
    expect(lifecycleDealerVisitTitle("Apkope")).toBe("Servisa apmeklējums");
    expect(lifecycleDealerVisitTitle("Update DVD Road Map Europe Professional")).toBe("Servisa apmeklējums");
  });
});

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
