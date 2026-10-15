import { isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";

export class B2bDemoIsolationError extends Error {
  readonly code = "cross_tenant";
  constructor(message = "Ieraksts nepieder šim tenantam.") {
    super(message);
    this.name = "B2bDemoIsolationError";
  }
}

export function assertSafeTenantId(tenantId: string): string {
  if (!isSafeB2bDemoTenantId(tenantId)) {
    throw new B2bDemoIsolationError("Nederīgs tenant_id.");
  }
  return tenantId;
}

export function assertSameTenant<T extends { tenantId: string }>(record: T, tenantId: string): T {
  const expected = assertSafeTenantId(tenantId);
  if (record.tenantId !== expected) {
    throw new B2bDemoIsolationError();
  }
  return record;
}

export function filterTenantRecords<T extends { tenantId: string }>(
  records: readonly T[],
  tenantId: string,
): T[] {
  const expected = assertSafeTenantId(tenantId);
  return records.filter((row) => row.tenantId === expected);
}

export function rejectForeignTenantId(requested: unknown, sessionTenantId: string): string {
  const expected = assertSafeTenantId(sessionTenantId);
  if (requested == null || requested === "") return expected;
  if (typeof requested !== "string" || requested !== expected) {
    throw new B2bDemoIsolationError("tenant_id no pieprasījuma nesakrīt ar sesiju.");
  }
  return expected;
}
