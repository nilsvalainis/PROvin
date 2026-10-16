import { describe, expect, it } from "vitest";
import {
  B2B_DEMO_INDEX_PATH,
  B2bDemoPathError,
  IRISS_OWN_STORAGE_PREFIXES,
  assertB2bDemoStoragePath,
  b2bDemoTenantAssetPath,
  b2bDemoTenantDataPath,
  b2bDemoTenantOrderPath,
  b2bDemoTenantOrdersIndexPath,
  b2bDemoTenantStoragePrefix,
  canB2bDemoAccessIrissOwnSessions,
  isB2bDemoPathUnderTenant,
  isForbiddenIrissOwnPath,
} from "./b2b-demo-paths";

describe("b2b demo storage paths", () => {
  it("liek visus failus zem tenants/{id}", () => {
    expect(b2bDemoTenantDataPath("tnt_abc123")).toBe("b2b-demo/tenants/tnt_abc123/data.json");
    expect(b2bDemoTenantAssetPath("tnt_abc123", "logo.png")).toBe("b2b-demo/tenants/tnt_abc123/assets/logo.png");
    expect(b2bDemoTenantOrdersIndexPath("tnt_abc123")).toBe("b2b-demo/tenants/tnt_abc123/orders-index.json");
    expect(b2bDemoTenantOrderPath("tnt_abc123", "ord_abcdef")).toBe("b2b-demo/tenants/tnt_abc123/orders/ord_abcdef.json");
    expect(b2bDemoTenantStoragePrefix("tnt_abc123")).toBe("b2b-demo/tenants/tnt_abc123/");
    expect(isB2bDemoPathUnderTenant("b2b-demo/tenants/tnt_abc123/data.json", "tnt_abc123")).toBe(true);
    expect(isB2bDemoPathUnderTenant("b2b-demo/tenants/tnt_abc1234/data.json", "tnt_abc123")).toBe(false);
    expect(isB2bDemoPathUnderTenant("b2b-demo/index.json", "tnt_abc123")).toBe(false);
    expect(assertB2bDemoStoragePath(B2B_DEMO_INDEX_PATH)).toBe(B2B_DEMO_INDEX_PATH);
  });

  it("noraida ĪRISS prefixus un sliktus id", () => {
    for (const prefix of IRISS_OWN_STORAGE_PREFIXES) {
      expect(isForbiddenIrissOwnPath(`${prefix}x.json`)).toBe(true);
      expect(() => assertB2bDemoStoragePath(`${prefix}x.json`)).toThrow(B2bDemoPathError);
    }
    expect(() => b2bDemoTenantDataPath("tnt_../evil")).toThrow(B2bDemoPathError);
    expect(() => b2bDemoTenantAssetPath("tnt_abc123", "../secret")).toThrow(B2bDemoPathError);
    expect(() => b2bDemoTenantOrderPath("tnt_abc123", "ord_../x")).toThrow(B2bDemoPathError);
    expect(b2bDemoTenantOrderPath("tnt_abc123", "ord_abcdef")).not.toContain("tnt_other1");
    expect(canB2bDemoAccessIrissOwnSessions()).toBe(false);
  });
});
