import { randomBytes } from "node:crypto";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoOrderId, isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import {
  isB2bDemoOrderStatus,
  type B2bDemoOrder,
  type B2bDemoOrderStatus,
} from "@/lib/b2b-demo-types";

function clip(value: unknown, max: number): string {
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

export function newB2bDemoOrderId(): string {
  return `ord_${randomBytes(8).toString("hex")}`;
}

export function parseB2bDemoOrder(raw: unknown, tenantId: string): B2bDemoOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const recordTenant = typeof o.tenantId === "string" ? o.tenantId.trim() : "";
  if (!isSafeB2bDemoOrderId(orderId) || !isSafeB2bDemoTenantId(recordTenant)) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  if (!createdAt) return null;
  const status: B2bDemoOrderStatus = isB2bDemoOrderStatus(o.status) ? o.status : "active";
  const vinRaw = typeof o.vin === "string" ? o.vin : "";
  const vin = vinRaw.trim() ? normalizeVin(vinRaw) : "";
  const order: B2bDemoOrder = {
    tenantId: recordTenant,
    orderId,
    clientName: clip(o.clientName, 160),
    brandModel: clip(o.brandModel, 160),
    vin,
    note: clip(o.note, 2000),
    status,
    createdAt,
    updatedAt: typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : createdAt,
  };
  try {
    return assertSameTenant(order, tenantId);
  } catch {
    return null;
  }
}

export type B2bDemoOrderInput = {
  clientName: string;
  brandModel: string;
  vin?: string;
  note?: string;
  status?: B2bDemoOrderStatus;
};

export function createB2bDemoOrder(tenantId: string, input: B2bDemoOrderInput, now = new Date().toISOString()): B2bDemoOrder {
  if (!isSafeB2bDemoTenantId(tenantId)) throw new Error("Nederīgs tenant_id.");
  const vin = input.vin?.trim() ? normalizeVin(input.vin) : "";
  if (vin && !isValidVin(vin)) throw new Error("Nederīgs VIN.");
  return {
    tenantId,
    orderId: newB2bDemoOrderId(),
    clientName: clip(input.clientName, 160),
    brandModel: clip(input.brandModel, 160),
    vin,
    note: clip(input.note, 2000),
    status: isB2bDemoOrderStatus(input.status) ? input.status : "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function applyB2bDemoOrderPatch(
  current: B2bDemoOrder,
  tenantId: string,
  patch: Partial<B2bDemoOrderInput>,
  now = new Date().toISOString(),
): B2bDemoOrder {
  assertSameTenant(current, tenantId);
  const vinRaw = patch.vin !== undefined ? patch.vin : current.vin;
  const vin = vinRaw.trim() ? normalizeVin(vinRaw) : "";
  if (vin && !isValidVin(vin)) throw new Error("Nederīgs VIN.");
  return {
    ...current,
    clientName: patch.clientName !== undefined ? clip(patch.clientName, 160) : current.clientName,
    brandModel: patch.brandModel !== undefined ? clip(patch.brandModel, 160) : current.brandModel,
    vin,
    note: patch.note !== undefined ? clip(patch.note, 2000) : current.note,
    status: isB2bDemoOrderStatus(patch.status) ? patch.status : current.status,
    updatedAt: now,
  };
}
