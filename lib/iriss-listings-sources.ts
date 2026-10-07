import { createHash } from "node:crypto";
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

export function irissListingSourceId(orderId: string, sourceUrl: string): string {
  return createHash("sha1").update(orderId).update("|").update(sourceUrl).digest("hex").slice(0, 20);
}

export function irissListingVehicleId(platform: IrissListingPlatform, externalId: string): string {
  return createHash("sha1").update(platform).update("|").update(externalId).digest("hex").slice(0, 20);
}

type SourceRow = Pick<
  IrissPasutijumsListRow,
  "id" | "brandModel" | "listStatus" | "listingLinkAutobid" | "listingLinkOpenline" | "listingLinkAuto1" | "listingLinksOther"
>;

/**
 * Avoti tikai no pasūtījumiem ar statusu „Aktīvs”. Mobile.de saite tiek izlaista (nākamā fāze).
 * „Citas saites” ņem tikai tad, ja hosts ir viena no trim izsolēm.
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
  for (const row of rows) {
    if (row.listStatus !== "active") continue;
    push(row, "autobid", row.listingLinkAutobid);
    push(row, "openline", row.listingLinkOpenline);
    push(row, "auto1", row.listingLinkAuto1);
    for (const other of row.listingLinksOther ?? []) {
      const url = cleanHttpUrl(other);
      if (!url) continue;
      push(row, detectIrissListingPlatform(url), url);
    }
  }
  return out;
}
