/** Outvin / autoDNA pirkumu slēdzene: atkārtojums nedrīkst tērēt kredītus otrreiz. */

export const VENDOR_PURCHASE_STALE_MS = 10 * 60 * 1000;

export type VendorPurchaseLockStatus = "pending" | "done";

export type VendorPurchaseLockEntry = {
  status: VendorPurchaseLockStatus;
  claimedAt: string;
  ok?: boolean;
  httpStatus?: number;
  payload?: unknown;
};

export type VendorPurchaseLockDecision = "begin" | "replay" | "in_progress" | "reclaim";

export function parseVendorPurchaseLockEntry(raw: unknown): VendorPurchaseLockEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status === "pending" || o.status === "done" ? o.status : null;
  const claimedAt = typeof o.claimedAt === "string" && o.claimedAt.trim() ? o.claimedAt.trim() : "";
  if (!status || !claimedAt) return null;
  const claimedMs = Date.parse(claimedAt);
  if (!Number.isFinite(claimedMs)) return null;
  return {
    status,
    claimedAt,
    ...(typeof o.ok === "boolean" ? { ok: o.ok } : {}),
    ...(typeof o.httpStatus === "number" && Number.isFinite(o.httpStatus) ? { httpStatus: o.httpStatus } : {}),
    ...("payload" in o ? { payload: o.payload } : {}),
  };
}

export function vendorPurchaseLockDecision(
  entry: VendorPurchaseLockEntry | null | undefined,
  now: number,
  staleMs = VENDOR_PURCHASE_STALE_MS,
): VendorPurchaseLockDecision {
  if (!entry) return "begin";
  if (entry.status === "done") return "replay";
  const claimedMs = Date.parse(entry.claimedAt);
  if (!Number.isFinite(claimedMs) || now - claimedMs > staleMs) return "reclaim";
  return "in_progress";
}

export function newVendorPurchasePending(now: number): VendorPurchaseLockEntry {
  return { status: "pending", claimedAt: new Date(now).toISOString() };
}

export function newVendorPurchaseDone(args: {
  now: number;
  ok: boolean;
  httpStatus?: number;
  payload?: unknown;
}): VendorPurchaseLockEntry {
  return {
    status: "done",
    claimedAt: new Date(args.now).toISOString(),
    ok: args.ok,
    ...(args.httpStatus != null ? { httpStatus: args.httpStatus } : {}),
    ...("payload" in args ? { payload: args.payload } : {}),
  };
}

export function isSafeVendorPurchaseVinKey(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vin.trim());
}
