import { createHash } from "node:crypto";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { cleanHttpUrl, detectIrissListingPlatform } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";
import type { IrissPasutijumsListRow } from "@/lib/iriss-pasutijumi-types";

export type IrissListingSource = {
  id: string;
  orderId: string;
  orderBrandModel: string;
  platform: IrissListingPlatform;
  sourceUrl: string;
};

/** Tas pats meklējums neatkarīgi no parametru secības un beigu slīpsvītras. */
export function normalizeListingUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    const pairs = [...u.searchParams.entries()].sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    u.search = "";
    for (const [k, v] of pairs) u.searchParams.append(k, v);
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export type IrissListingSourceGroup = {
  key: string;
  platform: IrissListingPlatform;
  /** Pirmā pasūtījuma URL, ar ko faktiski lasām. */
  sourceUrl: string;
  orders: IrissListingSource[];
};

/** Viens unikāls meklēšanas URL = viena nolasīšana, rezultāts visiem pasūtījumiem grupā. */
export function groupIrissListingSources(sources: IrissListingSource[]): IrissListingSourceGroup[] {
  const map = new Map<string, IrissListingSourceGroup>();
  for (const src of sources) {
    const key = `${src.platform}|${normalizeListingUrl(src.sourceUrl)}`;
    const hit = map.get(key);
    if (hit) {
      hit.orders.push(src);
      continue;
    }
    map.set(key, { key, platform: src.platform, sourceUrl: src.sourceUrl, orders: [src] });
  }
  return [...map.values()];
}

export function irissListingSourceId(orderId: string, sourceUrl: string): string {
  return createHash("sha1").update(orderId).update("|").update(sourceUrl).digest("hex").slice(0, 20);
}

export function irissListingVehicleId(platform: IrissListingPlatform, externalId: string): string {
  return createHash("sha1").update(platform).update("|").update(externalId).digest("hex").slice(0, 20);
}

type SourceRow = Pick<IrissPasutijumsListRow, "id" | "brandModel" | "listStatus"> & {
  listingLinkAutobid?: unknown;
  listingLinkOpenline?: unknown;
  listingLinkAuto1?: unknown;
  listingLinksOther?: unknown;
};

/**
 * Avoti tikai no pasūtījumiem ar statusu „Aktīvs”. Ņem visas Autobid / Openlane / Auto1
 * (un „Citi”, ja hosts ir izsole) saites. Identisks URL starp pasūtījumiem paliek viena nolasīšana.
 * Mobile.de saites šeit neiekļaujam (tās glabā un rāda formā / priekšskatījumā, bet nelasām).
 */
export function buildIrissListingSources(rows: SourceRow[]): IrissListingSource[] {
  const out: IrissListingSource[] = [];
  const seen = new Set<string>();
  const push = (row: SourceRow, platform: IrissListingPlatform | null, raw: string) => {
    if (!platform) return;
    const sourceUrl = cleanHttpUrl(raw);
    if (!sourceUrl) return;
    const detected = detectIrissListingPlatform(sourceUrl);
    /** Saite nepareizajā laukā (piem. Autobid URL Openlane laukā): uzticamies hostam. */
    const effective = detected ?? platform;
    const key = `${row.id}|${sourceUrl}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: irissListingSourceId(row.id, sourceUrl),
      orderId: row.id,
      orderBrandModel: row.brandModel.trim(),
      platform: effective,
      sourceUrl,
    });
  };
  const pushAll = (row: SourceRow, platform: IrissListingPlatform, raw: unknown) => {
    for (const url of filledIrissListingLinks(raw)) push(row, platform, url);
  };
  for (const row of rows) {
    if (row.listStatus !== "active") continue;
    pushAll(row, "autobid", row.listingLinkAutobid);
    pushAll(row, "openline", row.listingLinkOpenline);
    pushAll(row, "auto1", row.listingLinkAuto1);
    for (const other of filledIrissListingLinks(row.listingLinksOther)) {
      const url = cleanHttpUrl(other);
      if (!url) continue;
      push(row, detectIrissListingPlatform(url), url);
    }
  }
  return out;
}
