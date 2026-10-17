import { describe, expect, it } from "vitest";
import {
  dealerBrandHasWideMark,
  dealerBrandLogoPublicPath,
} from "@/lib/dealer-brand-logo-path";

describe("dealerBrandLogoPublicPath", () => {
  it("returns primary and wide paths with cache bust on light surface", () => {
    expect(dealerBrandLogoPublicPath("bmw")).toBe("/brand-logos/bmw.svg?v=13");
    expect(dealerBrandLogoPublicPath("subaru", { variant: "wide" })).toBe(
      "/brand-logos/subaru-wide.svg?v=13",
    );
    expect(dealerBrandLogoPublicPath("bmw", { variant: "wide" })).toBe("/brand-logos/bmw.svg?v=13");
  });

  it("serves legacy light marks from on-dark", () => {
    expect(dealerBrandLogoPublicPath("bmw", { surface: "dark", cacheBust: false })).toBe(
      "/brand-logos/on-dark/bmw.svg",
    );
  });

  it("flags wide slugs", () => {
    expect(dealerBrandHasWideMark("kia")).toBe(true);
    expect(dealerBrandHasWideMark("volvo")).toBe(false);
  });
});
