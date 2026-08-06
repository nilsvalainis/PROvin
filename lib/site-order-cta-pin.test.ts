import { describe, expect, it } from "vitest";
import { shouldHideSiteOrderCtaPin } from "@/lib/site-order-cta-pin";

describe("shouldHideSiteOrderCtaPin", () => {
  it("hides on home, checkout, services catalog, FAQ, select form, and demo", () => {
    expect(shouldHideSiteOrderCtaPin("/")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/lv")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/pasutit")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/lv/pakalpojumi")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/pakalpojumi")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/biezi-jautajumi")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/provin-select-pieteikums")).toBe(true);
    expect(shouldHideSiteOrderCtaPin("/demo/azvin")).toBe(true);
  });

  it("shows on secondary pages without header rail", () => {
    expect(shouldHideSiteOrderCtaPin("/privatuma-politika")).toBe(false);
    expect(shouldHideSiteOrderCtaPin("/lv/lietosanas-noteikumi")).toBe(false);
  });
});
