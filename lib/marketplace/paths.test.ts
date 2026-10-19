import { describe, expect, it } from "vitest";
import { IRISS_OWN_STORAGE_PREFIXES } from "@/lib/b2b-demo-paths";
import { marketplaceListingsFile, marketplaceStoragePrefix } from "@/lib/marketplace/paths";

describe("marketplace storage paths", () => {
  it("keeps IRISS and later B2B prefixes apart", () => {
    expect(marketplaceStoragePrefix({ kind: "iriss" })).toBe("iriss-marketplace/");
    expect(marketplaceListingsFile({ kind: "iriss" })).toBe("iriss-marketplace/listings.json");
    expect(IRISS_OWN_STORAGE_PREFIXES).toContain("iriss-marketplace/");
    expect(marketplaceStoragePrefix({ kind: "b2b", tenantId: "tnt_dealer01" })).toBe("b2b-demo/tenants/tnt_dealer01/marketplace/");
  });
});
