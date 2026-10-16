import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readSharedOrderCriteria } from "@/lib/iriss-criteria-shared";
import { emptyIrissCriteria } from "@/lib/iriss-criteria-types";
import { applyB2bDemoOrderPatch, parseB2bDemoOrder } from "@/lib/b2b-demo-orders";

const tenantId = "tnt_crit01";
const orderId = "ord_crit01";

const legacy = {
  tenantId,
  orderId,
  clientName: "Jānis Bērziņš",
  clientFirstName: "Jānis",
  clientLastName: "Bērziņš",
  phone: "+37120000000",
  brandModel: "Volvo XC60",
  vin: "",
  productionYears: "2018-2021",
  totalBudget: "18000",
  engineType: "dīzelis",
  transmission: "automāts",
  bodyType: "SUV",
  driveType: "AWD",
  seatCount: "5",
  maxMileage: "150000",
  preferredColors: "melna",
  nonPreferredColors: "dzeltena",
  equipmentRequired: "navigācija",
  note: "Klients grib pilnu servisa vēsturi",
  status: "active",
  offers: [],
  createdAt: "2024-03-01T10:00:00.000Z",
  updatedAt: "2024-11-02T15:30:00.000Z",
  legacyMarker: "do-not-drop",
};

describe("B2B criteria stays derived in memory", () => {
  it("round-trips a legacy order without writing criteria when the user does not edit", () => {
    const bytes = JSON.stringify(legacy);
    const parsedInput = JSON.parse(bytes) as typeof legacy & { criteria?: unknown };
    const order = parseB2bDemoOrder(parsedInput, tenantId);
    expect(order).not.toBeNull();
    expect(order?.criteria).toBeUndefined();
    expect(JSON.stringify(parsedInput)).toBe(bytes);
    expect(order?.brandModel).toBe("Volvo XC60");
    expect(order?.preferredColors).toBe("melna");
    expect(order?.note).toBe(legacy.note);

    const derived = readSharedOrderCriteria(order ?? {});
    expect(derived.filters[0]?.fuel.value).toEqual([{ group: "diesel" }]);
    expect(derived.filters[0]?.make.value).toContain("Volvo");
    expect(JSON.stringify(parsedInput)).toBe(bytes);

    const untouched = applyB2bDemoOrderPatch(order!, tenantId, {}, order!.updatedAt);
    expect(untouched.criteria).toBeUndefined();
    expect("criteria" in untouched).toBe(false);
    expect(JSON.stringify(untouched)).toBe(JSON.stringify(order));
    expect(untouched.engineType).toBe("dīzelis");
    expect(untouched.preferredColors).toBe("melna");
  });

  it("keeps an edited note and still does not store derived criteria", () => {
    const order = parseB2bDemoOrder(legacy, tenantId);
    const edited = applyB2bDemoOrderPatch(order!, tenantId, { note: "Zvani pēc 18" }, "2024-11-02T15:30:00.000Z");
    expect(edited.note).toBe("Zvani pēc 18");
    expect(edited.brandModel).toBe("Volvo XC60");
    expect(edited.engineType).toBe("dīzelis");
    expect(edited.transmission).toBe("automāts");
    expect(edited.bodyType).toBe("SUV");
    expect(edited.preferredColors).toBe("melna");
    expect(edited.equipmentRequired).toBe("navigācija");
    expect(edited.criteria).toBeUndefined();
    expect(JSON.stringify(edited)).not.toContain('"criteria"');
  });

  it("keeps criteria that was already stored and ignores a fresh migration", () => {
    const stored = emptyIrissCriteria();
    stored.filters[0]!.label = "Jau saglabāts";
    const order = parseB2bDemoOrder({ ...legacy, criteria: stored }, tenantId);
    expect(order?.criteria?.filters[0]?.label).toBe("Jau saglabāts");
    const edited = applyB2bDemoOrderPatch(order!, tenantId, { engineType: "benzīns" }, order!.updatedAt);
    expect(edited.engineType).toBe("benzīns");
    expect(edited.criteria).toStrictEqual(order?.criteria);
    expect(edited.criteria?.filters[0]?.label).toBe("Jau saglabāts");
    expect(edited.criteria?.filters[0]?.fuel.value).toEqual([]);
  });

  it("uses the same criteria form in IRISS and the B2B demo", () => {
    const iriss = readFileSync("components/admin/IrissPasutijumsEditor.tsx", "utf8");
    const demo = readFileSync("components/b2b-demo/B2bDemoOrdersClient.tsx", "utf8");
    expect(iriss).toContain('from "@/components/shared/SharedOrderCriteriaForm"');
    expect(demo).toContain('from "@/components/shared/SharedOrderCriteriaForm"');
    expect(iriss).toContain("<SharedOrderCriteriaForm ");
    expect(demo).toContain("<SharedOrderCriteriaForm ");
  });
});
