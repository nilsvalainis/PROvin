import { describe, expect, it } from "vitest";
import {
  normalizePathWithoutLocale,
  shouldBlockLegacyStandaloneProductPath,
} from "@/lib/legacy-standalone-product-routes";

describe("legacy standalone product routes", () => {
  it("normalizes locale-prefixed paths", () => {
    expect(normalizePathWithoutLocale("/lv/provin-audits")).toBe("/provin-audits");
    expect(normalizePathWithoutLocale("/en/provin-select")).toBe("/provin-select");
    expect(normalizePathWithoutLocale("/lv")).toBe("/");
  });

  it("blocks hidden standalone routes by default", () => {
    expect(shouldBlockLegacyStandaloneProductPath("/provin-audits")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/lv/provin-audits")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/provin-select")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/lv/provin-select-pieteikums")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/test-pricing-5")).toBe(false);
    expect(shouldBlockLegacyStandaloneProductPath("/lv/pasutit")).toBe(false);
  });
});
