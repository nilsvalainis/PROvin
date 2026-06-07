import { describe, expect, it } from "vitest";
import { validateTp5InlineFields } from "@/lib/test-pricing-5-inline-checkout";

describe("test-pricing-5 inline checkout", () => {
  it("requires valid vin and listing url", () => {
    expect(validateTp5InlineFields("", "").ok).toBe(false);
    expect(
      validateTp5InlineFields(
        "https://www.ss.lv/msg/lv/transport/cars/example.html",
        "",
      ).ok,
    ).toBe(false);
    expect(
      validateTp5InlineFields(
        "https://www.ss.lv/msg/lv/transport/cars/example.html",
        "1HGCM82633A004352",
      ).ok,
    ).toBe(true);
  });
});
