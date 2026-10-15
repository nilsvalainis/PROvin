/**
 * VIN dublikāti tikai pēc VIN (11-17, standarta alfabēts).
 * Nav izplūdušas markas / virsraksta salīdzināšanas.
 */

import { irissListingVin } from "@/lib/iriss-pasutijums-from-listing";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";
import { isPlaceholderVin } from "@/lib/order-field-validation";

export type IrissVinAnchor = {
  vin: string;
  kind: "order" | "offer";
  orderId: string;
  offerId?: string;
  label: string;
  href: string;
};

export type IrissVinDuplicateLink = {
  key: string;
  kind: "listing" | "order" | "offer";
  orderId?: string;
  label: string;
  href: string;
};

export type IrissVinListingRef = {
  id: string;
  vin?: string;
  title?: string;
  platform?: string;
};

type OfferVinRef = { id?: string; vin?: string; brandModel?: string; title?: string };

export type IrissVinAnchorRecord = {
  id: string;
  deletedAt?: string;
  vin?: string;
  brandModel?: string;
  clientFirstName?: string;
  clientLastName?: string;
  offers?: readonly OfferVinRef[];
};

function cleanVin(raw: string | undefined): string {
  const vin = irissListingVin(raw);
  if (!vin || isPlaceholderVin(vin)) return "";
  return vin;
}

function personLabel(rec: Pick<IrissVinAnchorRecord, "clientFirstName" | "clientLastName" | "brandModel">): string {
  const name = [rec.clientFirstName ?? "", rec.clientLastName ?? ""].map((s) => s.trim()).filter(Boolean).join(" ");
  const brand = (rec.brandModel ?? "").trim();
  return [name, brand].filter(Boolean).join(": ") || "Pasūtījums";
}

export function vinAnchorsFromRecord(rec: IrissVinAnchorRecord): IrissVinAnchor[] {
  if ((rec.deletedAt ?? "").trim() || !rec.id.trim()) return [];
  const href = `/admin/iriss/pasutijumi/${encodeURIComponent(rec.id)}`;
  const out: IrissVinAnchor[] = [];
  const orderVin = cleanVin(rec.vin);
  if (orderVin) {
    out.push({
      vin: orderVin,
      kind: "order",
      orderId: rec.id,
      label: personLabel(rec),
      href,
    });
  }
  for (const offer of rec.offers ?? []) {
    const vin = cleanVin(offer.vin);
    if (!vin) continue;
    const offerId = (offer.id ?? "").trim();
    const car = (offer.brandModel ?? "").trim() || (offer.title ?? "").trim() || "piedāvājums";
    out.push({
      vin,
      kind: "offer",
      orderId: rec.id,
      ...(offerId ? { offerId } : {}),
      label: `${personLabel(rec)} · ${car}`,
      href,
    });
  }
  return out;
}

function listingLabel(v: IrissVinListingRef): string {
  const platform = (v.platform ?? "") as IrissListingPlatform;
  const name = IRISS_LISTING_PLATFORM_LABEL[platform] ?? (v.platform ?? "").trim();
  const title = (v.title ?? "").trim() || "Sludinājums";
  return [name, title].filter(Boolean).join(" · ");
}

export function buildIrissVinDuplicateMap(
  vehicles: readonly IrissVinListingRef[],
  anchors: readonly IrissVinAnchor[],
): Map<string, IrissVinDuplicateLink[]> {
  const groups = new Map<string, IrissVinDuplicateLink[]>();
  const push = (vin: string, link: IrissVinDuplicateLink) => {
    const list = groups.get(vin) ?? [];
    if (list.some((item) => item.key === link.key)) return;
    list.push(link);
    groups.set(vin, list);
  };
  for (const v of vehicles) {
    const vin = cleanVin(v.vin);
    const id = v.id.trim();
    if (!vin || !id) continue;
    push(vin, {
      key: `listing:${id}`,
      kind: "listing",
      label: listingLabel(v),
      href: `/admin/iriss/sludinajumi?listing=${encodeURIComponent(id)}`,
    });
  }
  for (const a of anchors) {
    const vin = cleanVin(a.vin);
    if (!vin || !a.orderId.trim()) continue;
    const key = a.kind === "offer" ? `offer:${a.orderId}:${a.offerId ?? a.label}` : `order:${a.orderId}`;
    push(vin, {
      key,
      kind: a.kind,
      orderId: a.orderId,
      label: a.label,
      href: a.href || `/admin/iriss/pasutijumi/${encodeURIComponent(a.orderId)}`,
    });
  }
  const out = new Map<string, IrissVinDuplicateLink[]>();
  for (const [vin, links] of groups) {
    if (links.length < 2) continue;
    out.set(vin, links);
  }
  return out;
}

export function irissVinDuplicatesFor(
  vinRaw: string | undefined,
  selfKey: string,
  index: ReadonlyMap<string, IrissVinDuplicateLink[]>,
  excludeOrderId?: string,
): IrissVinDuplicateLink[] {
  const vin = cleanVin(vinRaw);
  if (!vin) return [];
  const links = index.get(vin) ?? [];
  return links.filter((link) => {
    if (link.key === selfKey) return false;
    if (excludeOrderId && link.kind === "order" && link.orderId === excludeOrderId) return false;
    return true;
  });
}

export function duplicateMapForListings(
  vehicles: readonly IrissVinListingRef[],
  anchors: readonly IrissVinAnchor[],
  excludeOrderId?: string,
): Record<string, IrissVinDuplicateLink[]> {
  const index = buildIrissVinDuplicateMap(vehicles, anchors);
  const out: Record<string, IrissVinDuplicateLink[]> = {};
  for (const v of vehicles) {
    const links = irissVinDuplicatesFor(v.vin, `listing:${v.id}`, index, excludeOrderId);
    if (links.length > 0) out[v.id] = links;
  }
  return out;
}
