import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectDealerAdminWarnings,
  countUntranslatedDealerWorkRows,
  dealerFactForWorkRow,
  originalDealerWorksForRow,
} from "@/lib/dealer-admin-service-rows";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";

describe("originalDealerWorksForRow", () => {
  it("savieno oriģinālo OneAuto rindu pēc datuma un km", () => {
    const original = [
      { date: "01.06.2023", odometer: "26276", place: "Bonn", works: "Engine oil change" },
      { date: "01.12.2023", odometer: "47521", place: "Bonn", works: "Cabin filter" },
    ];
    expect(
      originalDealerWorksForRow(
        { date: "01.06.2023", odometer: "26276", location: "Bonn", works: "Eļļas maiņa" },
        original,
      ),
    ).toBe("Engine oil change");
  });
});

describe("countUntranslatedDealerWorkRows", () => {
  it("skaita rindas, kurās vēl ir svešvalodas darbi", () => {
    expect(
      countUntranslatedDealerWorkRows([
        { date: "01.06.2023", odometer: "1000", location: "", works: "Engine oil change" },
        { date: "01.07.2023", odometer: "2000", location: "", works: "Eļļas maiņa" },
      ]),
    ).toBe(1);
  });
});

describe("dealerFactForWorkRow", () => {
  it("atgriež D-ID pēc datuma un km", () => {
    const rows = [
      { date: "02.05.2019", odometer: "60120", location: "", works: "Engine oil service" },
      { date: "10.08.2021", odometer: "121000", location: "", works: "Timing chain kit replaced" },
    ];
    const facts = extractDealerFactsFromServiceWorks(rows);
    const fact = dealerFactForWorkRow(rows[1]!, facts);
    expect(fact?.id).toBe("D2");
    expect(fact?.components).toContain("timing_chain");
  });
});

describe("collectDealerAdminWarnings", () => {
  it("bez kartes un teksta neatkarīgi no audita paliek tukšs", () => {
    expect(
      collectDealerAdminWarnings({
        serviceWorks: [{ date: "01.06.2023", odometer: "1000", location: "", works: "Eļļas maiņa" }],
      }),
    ).toEqual([]);
  });

  it("L15, ja dīlerī ir kampaņa, bet tehniskajos riskos tā nav", () => {
    const warnings = collectDealerAdminWarnings({
      serviceWorks: [
        {
          date: "15.01.2022",
          odometer: "140500",
          location: "",
          works: "Technische Aktion 001234 software update",
        },
      ],
      techRiskText: "Sadales ķēde šajā nobraukumā ir uzmanības punkts.",
    });
    expect(warnings.some((w) => w.id === "L15")).toBe(true);
  });

  it("neievelk Node fs / KB lintu admin klienta paketē", () => {
    const src = readFileSync(new URL("./dealer-admin-service-rows.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/admin-ai-technical-risk-lint/);
    expect(src).not.toMatch(/provin-kb/);
  });
});
