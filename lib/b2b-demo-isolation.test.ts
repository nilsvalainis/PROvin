import { describe, expect, it } from "vitest";
import { B2bDemoIsolationError, assertSameTenant, filterTenantRecords, rejectForeignTenantId } from "./b2b-demo-isolation";

describe("b2b demo isolation", () => {
  const a = "tnt_aaaaaa";
  const b = "tnt_bbbbbb";

  it("laiž tikai tā paša tenanta ierakstus", () => {
    expect(assertSameTenant({ tenantId: a, id: "1" }, a)).toEqual({ tenantId: a, id: "1" });
    expect(() => assertSameTenant({ tenantId: b, id: "1" }, a)).toThrow(B2bDemoIsolationError);
    expect(filterTenantRecords([{ tenantId: a }, { tenantId: b }, { tenantId: a }], a)).toEqual([
      { tenantId: a },
      { tenantId: a },
    ]);
  });

  it("neļauj pieprasījumā ievietot svešu tenant_id", () => {
    expect(rejectForeignTenantId(undefined, a)).toBe(a);
    expect(rejectForeignTenantId(a, a)).toBe(a);
    expect(() => rejectForeignTenantId(b, a)).toThrow(B2bDemoIsolationError);
  });
});

describe("b2b demo order path isolation", () => {
  const a = "tnt_aaaaaa";
  const b = "tnt_bbbbbb";

  it("order faili paliek zem sava tenanta", async () => {
    const { b2bDemoTenantOrderPath, b2bDemoTenantOrdersIndexPath, isB2bDemoPathUnderTenant } = await import("./b2b-demo-paths");
    expect(isB2bDemoPathUnderTenant(b2bDemoTenantOrderPath(a, "ord_abcdef"), a)).toBe(true);
    expect(isB2bDemoPathUnderTenant(b2bDemoTenantOrderPath(a, "ord_abcdef"), b)).toBe(false);
    expect(isB2bDemoPathUnderTenant(b2bDemoTenantOrdersIndexPath(a), b)).toBe(false);
  });
});
