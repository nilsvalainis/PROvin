import type { OrderDraftOrderEdits, OrderDraftState } from "@/lib/admin-order-draft-types";
import { orderDraftHasOrderEdits } from "@/lib/admin-order-draft-types";

export type OrderEditsLocalEnvelope = {
  savedAt?: string;
  orderEdits?: OrderDraftOrderEdits;
};

function parseSavedAtMs(raw: unknown): number {
  if (typeof raw !== "string") return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function normalizeOrderEditsObject(v: unknown): OrderDraftOrderEdits {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: OrderDraftOrderEdits = {};
  if (typeof o.vin === "string") out.vin = o.vin;
  if (typeof o.listingUrl === "string") out.listingUrl = o.listingUrl;
  if (typeof o.customerName === "string") out.customerName = o.customerName;
  if (typeof o.customerEmail === "string") out.customerEmail = o.customerEmail;
  if (typeof o.customerPhone === "string") out.customerPhone = o.customerPhone;
  if (typeof o.contactMethod === "string") out.contactMethod = o.contactMethod;
  if (typeof o.notes === "string") out.notes = o.notes;
  if (typeof o.internalComment === "string") out.internalComment = o.internalComment;
  if (typeof o.mileageComment === "string") out.mileageComment = o.mileageComment;
  return out;
}

export function parseOrderEditsFromLocalStorage(raw: string | null): {
  orderEdits: OrderDraftOrderEdits;
  savedAtMs: number;
} {
  if (!raw?.trim()) return { orderEdits: {}, savedAtMs: 0 };
  try {
    const p = JSON.parse(raw) as OrderEditsLocalEnvelope & Record<string, unknown>;
    if (!p || typeof p !== "object") return { orderEdits: {}, savedAtMs: 0 };
    if (p.orderEdits && typeof p.orderEdits === "object") {
      return {
        orderEdits: normalizeOrderEditsObject(p.orderEdits),
        savedAtMs: parseSavedAtMs(p.savedAt),
      };
    }
    return { orderEdits: normalizeOrderEditsObject(p), savedAtMs: 0 };
  } catch {
    return { orderEdits: {}, savedAtMs: 0 };
  }
}

export function serializeOrderEditsForLocalStorage(orderEdits: OrderDraftOrderEdits): string {
  return JSON.stringify({
    savedAt: new Date().toISOString(),
    orderEdits,
  } satisfies OrderEditsLocalEnvelope);
}

function coalesceOrderEdits(
  incoming: OrderDraftOrderEdits,
  baseline: OrderDraftOrderEdits,
): OrderDraftOrderEdits {
  const keys = [
    "vin",
    "listingUrl",
    "customerName",
    "customerEmail",
    "customerPhone",
    "contactMethod",
    "notes",
    "internalComment",
    "mileageComment",
  ] as const;
  const out: OrderDraftOrderEdits = { ...baseline };
  for (const key of keys) {
    const v = incoming[key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    const prev = out[key];
    if (typeof prev !== "string" || !prev.trim() || trimmed.length >= prev.trim().length) {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Pasūtījuma meta lauki (VIN, klients u.c.) — jaunākais avots uzvar; serveris nedrīkst pārrakstīt svaigu localStorage.
 */
export function pickOrderEditsForHydration(
  serverDraft: OrderDraftState | null | undefined,
  localRaw: string | null,
): OrderDraftOrderEdits {
  const local = parseOrderEditsFromLocalStorage(localRaw);
  const serverEdits = serverDraft?.orderEdits ?? {};
  const serverMs = serverDraft?.updatedAt ? Date.parse(serverDraft.updatedAt) : 0;
  const serverMsOk = Number.isFinite(serverMs) ? serverMs : 0;

  if (local.savedAtMs > serverMsOk + 500) {
    return coalesceOrderEdits(local.orderEdits, serverEdits);
  }
  /** Legacy / beforeunload — bez `savedAt`; neļaut serverim pārrakstīt ar tikai `updatedAt`. */
  if (local.savedAtMs === 0 && orderDraftHasOrderEdits(local.orderEdits)) {
    return coalesceOrderEdits(local.orderEdits, serverEdits);
  }
  if (orderDraftHasOrderEdits(serverEdits) && serverMsOk > 0 && serverMsOk >= local.savedAtMs) {
    return coalesceOrderEdits(serverEdits, local.orderEdits);
  }
  if (orderDraftHasOrderEdits(local.orderEdits)) return local.orderEdits;
  if (orderDraftHasOrderEdits(serverEdits)) return serverEdits;
  return {};
}
