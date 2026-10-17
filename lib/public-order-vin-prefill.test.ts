import { describe, expect, it } from "vitest";
import { buildPublicOrderPasutitUrl, publicOrderVinFromQuery } from "@/lib/public-order-vin-prefill";

describe("public-order-vin-prefill", () => {
  it("normalizes vin from query", () => {
    expect(publicOrderVinFromQuery("f18b2cd103d3420f3")).toBe("F18B2CD103D3420F3");
    expect(publicOrderVinFromQuery("")).toBe("");
  });

  it("builds pasutit url with vin", () => {
    expect(buildPublicOrderPasutitUrl("F18B2CD103D3420F3", "lv", "https://www.provin.lv")).toBe(
      "https://www.provin.lv/lv/pasutit?vin=F18B2CD103D3420F3",
    );
  });
});
