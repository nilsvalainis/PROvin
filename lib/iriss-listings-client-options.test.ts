import { describe, expect, it } from "vitest";
import { buildListingClientOptions, serializeListingOrderFilter, type IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

const o = (id: string, clientName: string, brandModel = "BMW X5", budget: number | null = 20000) =>
  ({ id, clientName, brandModel, productionYears: "2019", budget, listStatus: "active" }) as IrissListingOrderBrief;

describe("buildListingClientOptions", () => {
  it("one order client = one row, duplicates by id removed, names normalized", () => {
    const opts = buildListingClientOptions(
      [o("a", "Jānis Paraugs"), o("a", "Jānis Paraugs"), o("b", "Anna  Demo"), o("c", "anna demo", "Audi A6")],
      () => true,
      serializeListingOrderFilter,
      (n) => `${n} €`,
    );
    expect(opts.filter((x) => x.label.startsWith("Jānis")).length).toBe(1);
    const anna = opts.filter((x) => !x.indent && x.label.toLowerCase().startsWith("anna"));
    expect(anna.length).toBe(1);
    expect(anna[0]!.label).toContain("visi (2)");
    expect(opts.filter((x) => x.indent).length).toBe(2);
  });
});
