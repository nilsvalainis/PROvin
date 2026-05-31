import { describe, expect, it } from "vitest";
import { matchCarVerticalDamageDetail } from "@/lib/carvertical-damage-match";

describe("matchCarVerticalDamageDetail", () => {
  const details = [
    {
      date: "00.06.2024",
      country: "Šveice",
      lossAmount: "5001 € – 10 000 €",
      damagedSides: "Kreisā puse",
      damageGroups: "Virsbūve",
    },
  ];

  it("matches by date and country", () => {
    const m = matchCarVerticalDamageDetail(
      { csngDate: "00.06.2024", incidentNo: "Šveice", lossAmount: "5001 €" },
      details,
    );
    expect(m?.damagedSides).toBe("Kreisā puse");
  });

  it("matches by unique date when country differs", () => {
    const m = matchCarVerticalDamageDetail({ csngDate: "00.06.2024", incidentNo: "CH" }, details);
    expect(m?.damageGroups).toBe("Virsbūve");
  });
});
