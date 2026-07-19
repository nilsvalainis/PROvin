import { describe, expect, it } from "vitest";
import { matchCarVerticalDamageDetail } from "@/lib/carvertical-damage-match";

const details = [
  {
    date: "01.06.2024",
    country: "Šveice",
    lossAmount: "5001 € – 10 000 €",
    damagedSides: "Kreisā puse",
    damageGroups: "Virsbūve",
  },
];

describe("matchCarVerticalDamageDetail", () => {
  it("matches by date and country", () => {
    const m = matchCarVerticalDamageDetail(
      { csngDate: "01.06.2024", incidentNo: "Šveice", lossAmount: "5001 €" },
      details,
    );
    expect(m?.damagedSides).toBe("Kreisā puse");
  });

  it("matches by unique date when country differs", () => {
    const m = matchCarVerticalDamageDetail({ csngDate: "01.06.2024", incidentNo: "CH" }, details);
    expect(m?.country).toBe("Šveice");
  });

  it("treats legacy 00. day as equal to 01.", () => {
    const m = matchCarVerticalDamageDetail(
      { csngDate: "00.06.2024", incidentNo: "Šveice" },
      details,
    );
    expect(m?.damagedSides).toBe("Kreisā puse");
  });
});
