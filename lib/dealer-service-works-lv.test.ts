import { describe, expect, it } from "vitest";

import {
  applyDealerServiceWorksLvPayload,
  parseDealerServiceWorksLvPayload,
} from "@/lib/dealer-service-works-lv";
import { emptyVendorServiceEntry } from "@/lib/vendor-service-history";

describe("dīlera darbu AI tulkojuma JSON", () => {
  it("nolasa original → lv karti", () => {
    expect(
      parseDealerServiceWorksLvPayload(
        JSON.stringify({
          items: [
            { original: "Hex housing bracket", lv: "Korpusa kronšteins" },
            { original: "  ", lv: "tukšs" },
          ],
        }),
      ),
    ).toEqual({ "Hex housing bracket": "Korpusa kronšteins" });
  });

  it("aizstāj tikai norādītos darbus, saglabājot pārējos laukus", () => {
    const row = {
      ...emptyVendorServiceEntry(),
      date: "08.01.2025",
      odometer: "155000",
      location: "Niederlassung Bonn BMW AG, Bonn",
      works: ["Eļļas filtra komplekts", "Hex housing bracket"],
    };
    const next = applyDealerServiceWorksLvPayload(
      [row],
      JSON.stringify({
        items: [{ original: "Hex housing bracket", lv: "Korpusa kronšteins" }],
      }),
    );
    expect(next[0]?.location).toBe("Niederlassung Bonn BMW AG, Bonn");
    expect(next[0]?.works).toEqual(["Eļļas filtra komplekts", "Korpusa kronšteins"]);
  });
});
