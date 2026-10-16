import { isSafeB2bDemoOrderId, isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";

/** B2B demo Blob / FS root. Never overlaps ĪRISS or PROVIN admin prefixes. */
export const B2B_DEMO_STORAGE_ROOT = "b2b-demo";

export const B2B_DEMO_INDEX_PATH = `${B2B_DEMO_STORAGE_ROOT}/index.json`;

/**
 * ĪRISS single-tenant prefixes. B2B demo must never read or write these.
 * ĪRISS auction Chrome profiles live on the relay, not in this tree.
 */
export const IRISS_OWN_STORAGE_PREFIXES = [
  "iriss-pasutijumi/",
  "iriss-pasutijumi-backups/",
  "iriss-pavadzimes/",
  "iriss-listings/",
  "iriss-scan/",
] as const;

export const IRISS_OWN_RELAY_SESSION_SCOPE = "iriss-relay-chrome-profiles";

export class B2bDemoPathError extends Error {
  readonly code = "b2b_demo_path";
  constructor(message: string) {
    super(message);
    this.name = "B2bDemoPathError";
  }
}

export function b2bDemoTenantDir(tenantId: string): string {
  if (!isSafeB2bDemoTenantId(tenantId)) {
    throw new B2bDemoPathError("Nederīgs tenant_id.");
  }
  return `${B2B_DEMO_STORAGE_ROOT}/tenants/${tenantId}`;
}

/** Trailing slash prefix for Blob list / FS rm. Never matches a sibling tenant id. */
export function b2bDemoTenantStoragePrefix(tenantId: string): string {
  return `${b2bDemoTenantDir(tenantId)}/`;
}

export function isB2bDemoPathUnderTenant(pathname: string, tenantId: string): boolean {
  const p = pathname.replace(/^\/+/, "");
  const prefix = b2bDemoTenantStoragePrefix(tenantId);
  return p.startsWith(prefix) && !p.includes("..") && !p.includes("//");
}

export function b2bDemoTenantDataPath(tenantId: string): string {
  return `${b2bDemoTenantDir(tenantId)}/data.json`;
}

export function b2bDemoTenantAssetPath(tenantId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== filename || safe.includes("..")) {
    throw new B2bDemoPathError("Nederīgs faila nosaukums.");
  }
  return `${b2bDemoTenantDir(tenantId)}/assets/${safe}`;
}

/** Light list index. List endpoints must read this file, not each order JSON. */
export function b2bDemoTenantOrdersIndexPath(tenantId: string): string {
  return `${b2bDemoTenantDir(tenantId)}/orders-index.json`;
}

export function b2bDemoTenantOrderPath(tenantId: string, orderId: string): string {
  if (!isSafeB2bDemoOrderId(orderId)) {
    throw new B2bDemoPathError("Nederīgs order_id.");
  }
  return `${b2bDemoTenantDir(tenantId)}/orders/${orderId}.json`;
}

export function isForbiddenIrissOwnPath(pathname: string): boolean {
  const p = pathname.replace(/^\/+/, "");
  return IRISS_OWN_STORAGE_PREFIXES.some((prefix) => p === prefix.slice(0, -1) || p.startsWith(prefix));
}

export function assertB2bDemoStoragePath(pathname: string): string {
  const p = pathname.replace(/^\/+/, "");
  if (isForbiddenIrissOwnPath(p)) {
    throw new B2bDemoPathError("Aizliegts piekļūt ĪRISS krātuvei.");
  }
  if (p !== B2B_DEMO_INDEX_PATH && !p.startsWith(`${B2B_DEMO_STORAGE_ROOT}/tenants/`)) {
    throw new B2bDemoPathError("Ceļš nav tenant izolēts.");
  }
  if (p.includes("..") || p.includes("//")) {
    throw new B2bDemoPathError("Nederīgs krātuves ceļš.");
  }
  return p;
}

export function canB2bDemoAccessIrissOwnSessions(): false {
  return false;
}
