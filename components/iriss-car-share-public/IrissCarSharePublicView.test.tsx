import { describe, expect, it } from "vitest";
import { IrissCarSharePublicView } from "@/components/iriss-car-share-public/IrissCarSharePublicView";
import type { IrissCarSharePublicView as View } from "@/lib/iriss-car-share";
import { renderText } from "@/lib/test-render";

const view: View = {
  brand: "Dzintarzeme Auto",
  legalName: "SIA ĪRISS",
  title: "VW Passat Variant",
  year: "2019",
  color: "Pelēks",
  vin: "WVWZZZ3CZKE012345",
  mileage: "142 000 km",
  hasPhoto: false,
};

describe("IRISS publiskā auto saite bez cenas", () => {
  it("shows car basics and never a price", () => {
    const text = renderText(<IrissCarSharePublicView token="k7Q2xAb1" view={view} />);
    expect(text).toContain("VW Passat Variant");
    expect(text).toContain("Pamatdati bez cenas");
    expect(text).toContain("Dzintarzeme Auto");
    expect(text).not.toMatch(/€|EUR|\d[\d\s]*,\d{2}/);
  });
});
