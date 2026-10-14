import { describe, expect, it } from "vitest";
import { emptyAsvBlock } from "@/lib/asv-report";
import {
  buildAsvOverlapCompareRows,
  bundleFromAsvDisplay,
  mergeAsvSourceSnapshots,
  setAsvJojSnapshot,
  setAsvOneautoSnapshot,
} from "@/lib/asv-source-merge";

describe("asv-source-merge", () => {
  it("nedublē izsoles rindu, ja datums un odometrs sakrīt", () => {
    const prev = emptyAsvBlock();
    const oneauto = setAsvOneautoSnapshot(prev, {
      ...bundleFromAsvDisplay(prev),
      sales: [
        {
          date: "25.03.2026",
          venue: "VIN Audit salvage",
          odometer: "1 000 km",
          price: "12 000 USD",
          status: "",
        },
      ],
    });
    const merged = setAsvJojSnapshot(oneauto, {
      ...bundleFromAsvDisplay(emptyAsvBlock()),
      sales: [
        {
          date: "25.03.2026",
          venue: "Copart",
          odometer: "1 000 km",
          price: "12 500 USD",
          status: "Lots: 1",
        },
      ],
      damages: [{ date: "25.03.2026", region: "Copart", amount: "", description: "Side" }],
    });
    const sales = merged.sales.filter((s) => s.venue.trim());
    expect(sales).toHaveLength(1);
    expect(sales[0]?.venue).toBe("VIN Audit salvage");
  });

  it("JoJ pievieno tikai trūkstošās rindas un bojājumu", () => {
    const prev = emptyAsvBlock();
    const oneauto = setAsvOneautoSnapshot(prev, bundleFromAsvDisplay(prev));
    const merged = setAsvJojSnapshot(oneauto, {
      ...bundleFromAsvDisplay(emptyAsvBlock()),
      sales: [
        {
          date: "01.01.2020",
          venue: "Copart",
          odometer: "50 000 km",
          price: "5 000 USD",
          status: "",
        },
      ],
      damages: [{ date: "01.01.2020", region: "Copart", amount: "", description: "Front" }],
    });
    expect(merged.sales.some((s) => s.venue === "Copart")).toBe(true);
    expect(merged.damages.some((d) => /front/i.test(d.description))).toBe(true);
  });

  it("ģenerē pārklājuma salīdzinājuma rindas, kad abi avoti aizpildīti", () => {
    const rows = buildAsvOverlapCompareRows({
      oneauto: {
        ...bundleFromAsvDisplay(emptyAsvBlock()),
        reportDate: "01.04.2026",
        ownersCount: "2",
      },
      joj: {
        ...bundleFromAsvDisplay(emptyAsvBlock()),
        reportDate: "02.04.2026",
        ownersCount: "3",
      },
    });
    expect(rows.some((r) => r.field === "Atskaites datums")).toBe(true);
    expect(rows.some((r) => r.field === "Īpašnieku skaits" && r.stronger === "oneauto")).toBe(true);
  });
});
