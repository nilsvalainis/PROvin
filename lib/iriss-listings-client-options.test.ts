import { describe, expect, it } from "vitest";
import { buildListingClientOptions, serializeListingOrderFilter, type IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

const o = (id: string, clientName: string, brandModel = "BMW X5", budget: number | null = 20000, years = "2019") =>
  ({ id, clientName, brandModel, productionYears: years, budget, listStatus: "active" }) as IrissListingOrderBrief;

describe("buildListingClientOptions", () => {
  it("sorts by make then model and formats Marka · Modelis · Klients · gadi · budžets", () => {
    const opts = buildListingClientOptions(
      [
        o("a", "Zane", "VW Golf", 14000, "2018+"),
        o("b", "Jānis", "Audi A6", 20000, "2015-2018"),
        o("c", "Emīls", "BMW 545i", 9000, "vēlams līdz 2012"),
        o("d", "Emīls", "BMW 330", 12000, "2012+"),
      ],
      () => true,
      serializeListingOrderFilter,
      (n) => `${n} €`,
    );
    expect(opts.map((x) => x.label)).toEqual([
      "Audi · A6 · Jānis · 2015-2018 · 20000 €",
      "BMW · 330 · Emīls · 2012+ · 12000 €",
      "BMW · 545i · Emīls · vēlams līdz 2012 · 9000 €",
      "VW · Golf · Zane · 2018+ · 14000 €",
    ]);
    expect(opts.every((x) => !x.indent)).toBe(true);
  });

  it("dedupes by order id", () => {
    const opts = buildListingClientOptions(
      [o("a", "Jānis Paraugs"), o("a", "Jānis Paraugs"), o("b", "Anna Demo", "Audi A6")],
      () => true,
      serializeListingOrderFilter,
      (n) => `${n} €`,
    );
    expect(opts.length).toBe(2);
  });
});
