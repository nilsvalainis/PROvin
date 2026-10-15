/**
 * Klienta droša normalizācija IRISS istabas atbilstības props.
 * Tukši, daļēji un veci JSON nesit istabu ciet.
 */

import { isIrissListingHitStatus, type IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import { IRISS_ORDER_ROOM_TABS, type IrissOrderRoomTab } from "@/lib/iriss-order-room";
import type { IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function coerceIrissHitStatusMap(value: unknown): Record<string, IrissListingHitStatus> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, IrissListingHitStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    if (!key || typeof status !== "string" || !isIrissListingHitStatus(status)) continue;
    out[key] = status;
  }
  return out;
}

export function irissHitStatusOf(map: unknown, hitId: string): IrissListingHitStatus {
  const clean = coerceIrissHitStatusMap(map);
  return clean[hitId] ?? "skatits";
}

/** Nav ieraksta šim sludinājumam. `in` pret null/undefined met TypeError. */
export function irissHitStatusIsUnset(map: unknown, hitId: string): boolean {
  if (!isPlainObject(map)) return true;
  return !Object.prototype.hasOwnProperty.call(map, hitId);
}

export function coerceIrissVinDuplicateLinks(value: unknown): IrissVinDuplicateLink[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const out: IrissVinDuplicateLink[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const href = typeof item.href === "string" ? item.href.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!href || !label) continue;
    const keyRaw = typeof item.key === "string" ? item.key.trim() : "";
    let key = keyRaw || href;
    let n = 2;
    while (used.has(key)) {
      key = `${keyRaw || href}#${n}`;
      n += 1;
    }
    used.add(key);
    const kind = item.kind === "listing" || item.kind === "order" || item.kind === "offer" ? item.kind : "listing";
    const orderId = typeof item.orderId === "string" ? item.orderId.trim() : "";
    out.push({ key, kind, label, href, ...(orderId ? { orderId } : {}) });
  }
  return out;
}

export function coerceIrissDuplicatesByListing(value: unknown): Record<string, IrissVinDuplicateLink[]> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, IrissVinDuplicateLink[]> = {};
  for (const [id, links] of Object.entries(value)) {
    if (!id) continue;
    const clean = coerceIrissVinDuplicateLinks(links);
    if (clean.length > 0) out[id] = clean;
  }
  return out;
}

export function coerceIrissOrderRoomTab(value: unknown): IrissOrderRoomTab {
  return typeof value === "string" && (IRISS_ORDER_ROOM_TABS as readonly string[]).includes(value)
    ? (value as IrissOrderRoomTab)
    : "overview";
}
