import { describe, expect, it } from "vitest";
import { emptyIrissCriteria, irissCriteriaIsOperatorAuthored, irissCriteriaValue } from "@/lib/iriss-criteria-types";
import { retainStoredIrissCriteria } from "@/lib/iriss-criteria-migrate";
import {
  applyIrissOrderRangeEdit,
  formatIrissRangePair,
  irissOrderRangeErrorFor,
  irissOrderRangeView,
  parseDisplacementCc,
  parsePowerKwInput,
} from "@/lib/iriss-order-range-fields";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

describe("parseDisplacementCc", () => {
  it("reads liters and cm3", () => {
    expect(parseDisplacementCc("1.6").value).toBe(1600);
    expect(parseDisplacementCc("1,6 l").value).toBe(1600);
    expect(parseDisplacementCc("2000").value).toBe(2000);
    expect(parseDisplacementCc("1998 cm3").value).toBe(1998);
    expect(parseDisplacementCc("").value).toBeNull();
  });
});

describe("parsePowerKwInput", () => {
  it("reads kW and ZS", () => {
    expect(parsePowerKwInput("140").value).toBe(140);
    expect(parsePowerKwInput("150 ZS").value).toBe(110);
    expect(parsePowerKwInput("140 kW").value).toBe(140);
  });
});

describe("applyIrissOrderRangeEdit", () => {
  it("writes structured criteria and legacy from-to text", () => {
    const rec = emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-19T10:00:00.000Z");
    rec.brandModel = "Volvo XC60";
    const priced = applyIrissOrderRangeEdit(rec, "budgetFrom", "10000", 1);
    const both = applyIrissOrderRangeEdit(priced, "budgetTo", "22000", 2);
    const years = applyIrissOrderRangeEdit(both, "yearFrom", "2018", 3);
    const yearsTo = applyIrissOrderRangeEdit(years, "yearTo", "2021", 4);
    expect(yearsTo.totalBudget).toBe("10000-22000");
    expect(yearsTo.productionYears).toBe("2018-2021");
    expect(yearsTo.criteria?.filters[0]?.budgetFrom.value).toBe(10000);
    expect(yearsTo.criteria?.filters[0]?.budgetTo.value).toBe(22000);
    expect(yearsTo.criteria?.filters[0]?.yearFrom.source).toBe("form");
    expect(irissCriteriaIsOperatorAuthored(yearsTo.criteria)).toBe(true);
    expect(irissOrderRangeView(yearsTo).budgetFrom).toBe("10000");
    expect(formatIrissRangePair(2018, 2021)).toBe("2018-2021");
  });

  it("flags inverted from-to", () => {
    const rec = emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-19T10:00:00.000Z");
    const high = applyIrissOrderRangeEdit(rec, "yearFrom", "2022", 1);
    const bad = applyIrissOrderRangeEdit(high, "yearTo", "2018", 2);
    expect(irissOrderRangeErrorFor(bad, "year")).toMatch(/no nedrīkst būt lielāks/);
  });
});

describe("retainStoredIrissCriteria with operator ranges", () => {
  it("persists form-authored criteria onto a legacy record", () => {
    const stored = emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-19T10:00:00.000Z");
    stored.brandModel = "Volvo XC60";
    const incoming = applyIrissOrderRangeEdit(stored, "budgetFrom", "12000", 1);
    const kept = retainStoredIrissCriteria(stored, incoming);
    expect(kept.criteria?.filters[0]?.budgetFrom.value).toBe(12000);
    expect(kept.brandModel).toBe("Volvo XC60");
  });

  it("keeps stored criteria when incoming is only a migrated snapshot", () => {
    const storedCrit = emptyIrissCriteria();
    storedCrit.filters[0]!.label = "Jau saglabāts";
    storedCrit.filters[0]!.budgetTo = irissCriteriaValue(18000, "form");
    const stored = { criteria: storedCrit };
    const incoming = {
      notes: "x",
      criteria: emptyIrissCriteria(),
    };
    const kept = retainStoredIrissCriteria(stored, incoming);
    expect(kept.criteria?.filters[0]?.label).toBe("Jau saglabāts");
  });
});
