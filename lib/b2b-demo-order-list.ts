import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoOrderId, isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import { b2bDemoClientDisplayName } from "@/lib/b2b-demo-orders";
import {
  isB2bDemoOrderStatus,
  type B2bDemoOrder,
  type B2bDemoOrderListPage,
  type B2bDemoOrderListRow,
  type B2bDemoOrderStatus,
  type B2bDemoOrdersIndex,
} from "@/lib/b2b-demo-types";

export const B2B_DEMO_ORDER_PAGE_DEFAULT = 30;
export const B2B_DEMO_ORDER_PAGE_MAX = 50;

export function emptyB2bDemoOrdersIndex(tenantId: string, now = new Date().toISOString()): B2bDemoOrdersIndex {
  if (!isSafeB2bDemoTenantId(tenantId)) throw new Error("Nederīgs tenant_id.");
  return { version: 1, tenantId, updatedAt: now, rows: [] };
}

export function b2bDemoOrderToListRow(order: B2bDemoOrder): B2bDemoOrderListRow {
  const latest = order.offers
    .map((o) => o.validUntil.trim())
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    tenantId: order.tenantId,
    orderId: order.orderId,
    clientName: b2bDemoClientDisplayName(order),
    brandModel: order.brandModel,
    vin: order.vin,
    phone: order.phone,
    orderDate: order.orderDate,
    totalBudget: order.totalBudget,
    status: order.status,
    offerCount: order.offers.length,
    latestOfferValidUntil: latest ?? "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function parseB2bDemoOrderListRow(raw: unknown, tenantId: string): B2bDemoOrderListRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const recordTenant = typeof o.tenantId === "string" ? o.tenantId.trim() : "";
  if (!isSafeB2bDemoOrderId(orderId) || recordTenant !== tenantId) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  if (!createdAt) return null;
  const row: B2bDemoOrderListRow = {
    tenantId: recordTenant,
    orderId,
    clientName: typeof o.clientName === "string" ? o.clientName.slice(0, 160) : "",
    brandModel: typeof o.brandModel === "string" ? o.brandModel.slice(0, 160) : "",
    vin: typeof o.vin === "string" ? o.vin.slice(0, 32) : "",
    phone: typeof o.phone === "string" ? o.phone.slice(0, 40) : "",
    orderDate: typeof o.orderDate === "string" ? o.orderDate.slice(0, 16) : "",
    totalBudget: typeof o.totalBudget === "string" ? o.totalBudget.slice(0, 40) : "",
    status: isB2bDemoOrderStatus(o.status) ? o.status : "active",
    offerCount: typeof o.offerCount === "number" && Number.isFinite(o.offerCount) ? Math.max(0, Math.floor(o.offerCount)) : 0,
    latestOfferValidUntil: typeof o.latestOfferValidUntil === "string" ? o.latestOfferValidUntil.slice(0, 16) : "",
    createdAt,
    updatedAt: typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : createdAt,
  };
  try {
    return assertSameTenant(row, tenantId);
  } catch {
    return null;
  }
}

export function parseB2bDemoOrdersIndex(raw: unknown, tenantId: string): B2bDemoOrdersIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const recordTenant = typeof o.tenantId === "string" ? o.tenantId.trim() : "";
  if (recordTenant !== tenantId || !isSafeB2bDemoTenantId(recordTenant)) return null;
  const rowsRaw = Array.isArray(o.rows) ? o.rows : [];
  const rows = rowsRaw
    .map((row) => parseB2bDemoOrderListRow(row, tenantId))
    .filter((row): row is B2bDemoOrderListRow => Boolean(row));
  return {
    version: 1,
    tenantId: recordTenant,
    updatedAt: typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : new Date().toISOString(),
    rows,
  };
}

export function upsertB2bDemoOrderListRow(index: B2bDemoOrdersIndex, row: B2bDemoOrderListRow, now = new Date().toISOString()): B2bDemoOrdersIndex {
  assertSameTenant(index, row.tenantId);
  assertSameTenant(row, index.tenantId);
  const rest = index.rows.filter((r) => r.orderId !== row.orderId);
  return {
    ...index,
    updatedAt: now,
    rows: sortB2bDemoOrderListRows([...rest, row]),
  };
}

export function removeB2bDemoOrderListRow(index: B2bDemoOrdersIndex, tenantId: string, orderId: string, now = new Date().toISOString()): B2bDemoOrdersIndex {
  assertSameTenant(index, tenantId);
  return {
    ...index,
    updatedAt: now,
    rows: index.rows.filter((r) => r.orderId !== orderId),
  };
}

export function sortB2bDemoOrderListRows(rows: readonly B2bDemoOrderListRow[]): B2bDemoOrderListRow[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderId.localeCompare(a.orderId));
}

export type B2bDemoOrderListQuery = {
  page?: number;
  limit?: number;
  status?: string | null;
};

export function parseB2bDemoOrderListQuery(input: B2bDemoOrderListQuery): {
  page: number;
  limit: number;
  status: B2bDemoOrderStatus | null;
} {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const rawLimit = Math.floor(Number(input.limit) || B2B_DEMO_ORDER_PAGE_DEFAULT);
  const limit = Math.min(B2B_DEMO_ORDER_PAGE_MAX, Math.max(1, rawLimit));
  const status = isB2bDemoOrderStatus(input.status) ? input.status : null;
  return { page, limit, status };
}

export function paginateB2bDemoOrderIndex(
  index: B2bDemoOrdersIndex,
  tenantId: string,
  query: B2bDemoOrderListQuery = {},
): B2bDemoOrderListPage {
  assertSameTenant(index, tenantId);
  const { page, limit, status } = parseB2bDemoOrderListQuery(query);
  const filtered = sortB2bDemoOrderListRows(index.rows.filter((row) => row.tenantId === tenantId && (!status || row.status === status)));
  const start = (page - 1) * limit;
  return {
    tenantId,
    page,
    limit,
    total: filtered.length,
    rows: filtered.slice(start, start + limit),
  };
}
