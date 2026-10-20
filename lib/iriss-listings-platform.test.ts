import { describe, expect, it } from "vitest";
import {
  detectIrissListingPlatform,
  isAllowedListingSourceUrl,
  normalizeAllowedListingSourceUrl,
} from "@/lib/iriss-listings-platform";

describe("listing source URL allowlist", () => {
  it("allows known auction hosts over https and upgrades http", () => {
    expect(normalizeAllowedListingSourceUrl("https://www.openlane.eu/en/findcar?makes=volvo")).toContain(
      "openlane.eu",
    );
    expect(normalizeAllowedListingSourceUrl("http://autobid.de/en/search-results")).toMatch(/^https:\/\/autobid\.de/);
    expect(isAllowedListingSourceUrl("https://www.auto1.com/x")).toBe(true);
    expect(isAllowedListingSourceUrl("https://ecarstrade.com/search")).toBe(true);
  });

  it("rejects other hosts, credentials and IP literals", () => {
    expect(detectIrissListingPlatform("https://evil.example/openlane.eu")).toBeNull();
    expect(isAllowedListingSourceUrl("https://evil.example/findcar")).toBe(false);
    expect(isAllowedListingSourceUrl("https://user:pass@www.openlane.eu/en/findcar")).toBe(false);
    expect(isAllowedListingSourceUrl("https://127.0.0.1/")).toBe(false);
    expect(isAllowedListingSourceUrl("https://www.openlane.eu:8443/en/findcar")).toBe(false);
  });
});
