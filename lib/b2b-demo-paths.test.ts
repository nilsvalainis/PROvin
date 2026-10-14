import { describe, expect, it } from "vitest";
import {
  B2B_DEMO_INDEX_PATH,
  B2bDemoPathError,
  IRISS_OWN_STORAGE_PREFIXES,
  assertB2bDemoStoragePath,
  b2bDemoTenantAssetPath,
  b2bDemoTenantDataPath,
  canB2bDemoAccessIrissOwnSessions,
  isForbiddenIrissOwnPath,
} from "./b2b-demo-paths";

describe("b2b demo storage paths", () => {
  it("liek visus failus zem tenants/{id}", () => {
    expect(b2bDemoTenantDataPath("tnt_abc123")).toBe("b2b-demo/tenants/tnt_abc123/data.json");
    expect(b2bDemoTenantAssetPath("tnt_abc123", "logo.png")).toBe("b2b-demo/tenants/tnt_abc123/assets/logo.png");
    expect(assertB2bDemoStoragePath(B2B_DEMO_INDEX_PATH)).toBe(B2B_DEMO_INDEX_PATH);
  });

  it("noraida ĪRISS prefixus un sliktus id", () => {
    for (const prefix of IRISS_OWN_STORAGE_PREFIXES) {
      expect(isForbiddenIrissOwnPath(`${prefix}x.json`)).toBe(true);
      expect(() => assertB2bDemoStoragePath(`${prefix}x.json`)).toThrow(B2bDemoPathError);
    }
    expect(() => b2bDemoTenantDataPath("tnt_../evil")).toThrow(B2bDemoPathError);
    expect(() => b2bDemoTenantAssetPath("tnt_abc123", "../secret")).toThrow(B2bDemoPathError);
    expect(canB2bDemoAccessIrissOwnSessions()).toBe(false);
  });
});
