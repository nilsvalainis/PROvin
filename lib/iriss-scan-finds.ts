import { listingFmtEur } from "@/lib/iriss-listings-card";
import type { IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import { irissScanIdFromOrderId, isIrissScanOrderId } from "@/lib/iriss-scan-listings";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export const IRISS_SCAN_FIND_BUCKETS = ["new", "saved", "reject"] as const;
export type IrissScanFindBucket = (typeof IRISS_SCAN_FIND_BUCKETS)[number];

export type IrissScanFindCard = {
  listingId: string;
  scanId: string;
  orderId: string;
  title: string;
  spec: string;
  priceLabel: string;
  costLabel: string;
  budgetLabel: string;
  budgetOk: boolean | null;
  imageUrl: string;
  detailUrl: string;
  platform: string;
  status: IrissListingHitStatus;
  bucket: IrissScanFindBucket;
  matchedAt: string;
};

export function irissScanFindBucket(status: IrissListingHitStatus | string, change?: string): IrissScanFindBucket {
  if (status === "interesants") return "saved";
  if (status === "noraidits") return "reject";
  if (status === "jauns" || !status || (status === "skatits" && change === "new")) return "new";
  if (status === "skatits") return "new";
  return "new";
}

export function formatIrissScanBudgetDelta(budget: number | null, price: number | null): {
  label: string;
  ok: boolean | null;
} {
  if (budget == null || budget <= 0 || price == null || !Number.isFinite(price)) {
    return { label: "", ok: null };
  }
  const left = Math.round(budget - price);
  if (left >= 0) return { label: `Budžetā +${listingFmtEur(left)}`, ok: true };
  return { label: `Budžets -${listingFmtEur(-left)}`, ok: false };
}

export function formatIrissScanFindSpec(input: {
  year?: string;
  mileageKm?: number | null;
  powerKw?: string;
  platform?: string;
  countryCode?: string;
}): string {
  const km =
    typeof input.mileageKm === "number" && input.mileageKm > 0
      ? `${String(Math.round(input.mileageKm)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`
      : "";
  const kw = (input.powerKw ?? "").trim();
  const kwLabel = kw ? (/kW/i.test(kw) ? kw : `${kw} kW`) : "";
  const platform = input.platform
    ? IRISS_LISTING_PLATFORM_LABEL[input.platform as IrissListingPlatform] ?? input.platform
    : "";
  return [input.year?.trim(), km, kwLabel, platform, (input.countryCode ?? "").trim().toUpperCase()]
    .filter(Boolean)
    .join(" · ");
}

export function buildIrissScanFindCards(input: {
  vehicles: readonly {
    id: string;
    title?: string;
    year?: string;
    mileageKm?: number | null;
    powerKw?: string;
    platform?: string;
    countryCode?: string;
    imageUrl?: string;
    thumbUrl?: string;
    detailUrl?: string;
    price?: number | null;
    priceCurrent?: number | null;
    priceTotal?: number | null;
    orderIds?: readonly string[];
    firstSeenAt?: string;
    change?: string;
  }[];
  entries: readonly { orderId: string; listingId: string; status: string; matchedAt: string }[];
  budgetsByScanId?: Record<string, number | null>;
  /**
   * Ja dots: arī auto, ko Radaram piesaistīja meklēšanas saites (`scan:` orderIds), bet atbilstību
   * dzinējs vēl nav ierakstījis - tos rāda kā jaunus, ja pirmoreiz redzēti `recentHours` laikā
   * (tas pats logs kā Sludinājumi -> Monitorings «Jauni»; audits 26.10: Radarā «Jauni 0», Sludinājumos 38).
   */
  nowMs?: number;
  recentHours?: number;
}): IrissScanFindCard[] {
  const byId = new Map(input.vehicles.map((v) => [v.id, v]));
  const out: IrissScanFindCard[] = [];
  const seen = new Set<string>();
  const sorted = [...input.entries].sort((a, b) => (a.matchedAt < b.matchedAt ? 1 : a.matchedAt > b.matchedAt ? -1 : 0));
  const linked: { orderId: string; listingId: string; status: string; matchedAt: string }[] = [];
  if (input.nowMs != null) {
    const windowMs = (input.recentHours ?? 36) * 36e5;
    for (const v of input.vehicles) {
      if (v.change === "gone") continue;
      const seenAt = Date.parse(v.firstSeenAt ?? "");
      if (!Number.isFinite(seenAt) || input.nowMs - seenAt > windowMs) continue;
      for (const orderId of v.orderIds ?? []) {
        if (isIrissScanOrderId(orderId)) linked.push({ orderId, listingId: v.id, status: "jauns", matchedAt: v.firstSeenAt! });
      }
    }
    linked.sort((a, b) => (a.matchedAt < b.matchedAt ? 1 : a.matchedAt > b.matchedAt ? -1 : 0));
  }
  // Atbilstību ieraksti (ar operatora statusu) vispirms, tad saišu auto bez ieraksta.
  for (const e of [...sorted, ...linked]) {
    if (!isIrissScanOrderId(e.orderId)) continue;
    const key = `${e.orderId}|${e.listingId}`;
    if (seen.has(key)) continue;
    const v = byId.get(e.listingId);
    if (!v) continue;
    seen.add(key);
    const scanId = irissScanIdFromOrderId(e.orderId);
    const price = v.priceCurrent ?? v.price ?? null;
    const cost = v.priceTotal ?? null;
    const budget = input.budgetsByScanId?.[scanId] ?? null;
    const delta = formatIrissScanBudgetDelta(budget, price);
    const status = (e.status || "jauns") as IrissListingHitStatus;
    out.push({
      listingId: e.listingId,
      scanId,
      orderId: e.orderId,
      title: (v.title ?? "").trim() || "Sludinājums",
      spec: formatIrissScanFindSpec(v),
      priceLabel: listingFmtEur(price),
      costLabel: cost != null && cost !== price ? `izmaksas ${listingFmtEur(cost)}` : "",
      budgetLabel: delta.label,
      budgetOk: delta.ok,
      imageUrl: (v.thumbUrl || v.imageUrl || "").trim(),
      detailUrl: (v.detailUrl ?? "").trim(),
      platform: v.platform ?? "",
      status,
      bucket: irissScanFindBucket(status),
      matchedAt: e.matchedAt,
    });
  }
  return out;
}
