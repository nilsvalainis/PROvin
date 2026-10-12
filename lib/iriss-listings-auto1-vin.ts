/**
 * Auto1 VIN beyond search hits[].
 *
 * Captured 2026-10-09 VAT fixture (`lib/__fixtures__/iriss-vat/auto1.json`, 35
 * merchant searches) stores only tax/price keys on each hit. None of those
 * records include `vin` / `vinNumber` / `vehicleIdentificationNumber`.
 *
 * The Hetzner relay reads only `GET /v1/car-search/cars/search/<searchId>`
 * (`hits[]`). It does not open `/en/app/merchant/car/{stockNumber}`. List XHR
 * therefore never includes the documents tab, DAT "Fahrzeugdaten laut
 * Identifikationsnummer" block, or a damage-report payload. AUTO1 T&C mention
 * that DAT VIN-decoded equipment exists on the *detail* description; they do
 * not expose the VIN string on the search hit. Merchant VIN is a known
 * product hold-back (anti VIN-check shopping) until after purchase.
 *
 * Per-car detail fetch via the Chrome queue would cost one sequential relay
 * job per listing (daily cap 150, shared with list sync) and still likely
 * return no VIN. So we do not open detail pages here.
 *
 * Fallback, off the ingest path: optional OCR of listing photos (service
 * book / registration / invoices / dash plate), ISO 3779 check digit, cached
 * on the vehicle as vinSource=ocr_photo. LIST kartīte VIN avota zīmi nerāda.
 */

import { pickListingVin } from "@/lib/iriss-listings-extract";
import { extractIso3779VinFromUrls, isDocumentLikeListingImage } from "@/lib/iriss-listings-vin-from-photos";
import type { IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function hitId(hit: Record<string, unknown>): string {
  return asText(hit.id) || asText(hit.stockNumber);
}

function imageUrlsFromHit(hit: Record<string, unknown>): { urls: string[]; docs: string[] } {
  const images = Array.isArray(hit.images) ? hit.images : [];
  const urls: string[] = [];
  const docs: string[] = [];
  const main = asText(hit.mainImageFullUrl);
  if (main) urls.push(main);
  for (const img of images) {
    const rec = isRec(img) ? img : null;
    const url = rec ? asText(rec.fullUrl) || asText(rec.url) : asText(img);
    if (!url || urls.includes(url)) continue;
    urls.push(url);
    const kind = rec ? asText(rec.type) || asText(rec.imageType) || asText(rec.category) || asText(rec.tag) : "";
    if (isDocumentLikeListingImage(url, kind)) docs.push(url);
  }
  return { urls, docs };
}

function walkHits(value: unknown, out: Record<string, unknown>[], depth = 0, seen: Set<unknown> = new Set()): void {
  if (depth > 8 || value == null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((x) => isRec(x) && (x.id != null || x.stockNumber != null))) {
      for (const x of value) if (isRec(x)) out.push(x);
      return;
    }
    for (const x of value) walkHits(x, out, depth + 1, seen);
    return;
  }
  const rec = value as Record<string, unknown>;
  if (Array.isArray(rec.hits)) walkHits(rec.hits, out, depth + 1, seen);
  for (const v of Object.values(rec)) walkHits(v, out, depth + 1, seen);
}

/** Hits from a stored auto1-xhr raw page blob (stringified JSON or object). */
export function auto1HitsFromRawPages(raw: unknown): Record<string, unknown>[] {
  const hits: Record<string, unknown>[] = [];
  const blobs: unknown[] = Array.isArray(raw) ? raw : [raw];
  for (const blob of blobs) {
    let value: unknown = blob;
    if (typeof blob === "string") {
      try {
        value = JSON.parse(blob) as unknown;
      } catch {
        continue;
      }
    }
    if (isRec(value) && Array.isArray(value.pages)) {
      for (const page of value.pages) {
        const json = isRec(page) ? page.json ?? page : page;
        walkHits(json, hits);
      }
      continue;
    }
    walkHits(value, hits);
  }
  return hits;
}

export type Auto1VinHint = {
  vin: string;
  documentImageUrls: string[];
};

export function auto1VinHintsFromRaw(raw: unknown): Map<string, Auto1VinHint> {
  const map = new Map<string, Auto1VinHint>();
  for (const hit of auto1HitsFromRawPages(raw)) {
    const keys = [asText(hit.id), asText(hit.stockNumber), hitId(hit)].filter(Boolean);
    if (keys.length === 0) continue;
    const { urls, docs } = imageUrlsFromHit(hit);
    const vin = pickListingVin(hit) || extractIso3779VinFromUrls(urls);
    const hint: Auto1VinHint = {
      vin: vin || keys.map((k) => map.get(k)?.vin).find(Boolean) || "",
      documentImageUrls: [...new Set([...keys.flatMap((k) => map.get(k)?.documentImageUrls ?? []), ...docs])],
    };
    for (const key of keys) map.set(key, hint);
  }
  return map;
}

export function applyAuto1VinHints(vehicles: IrissFetchedVehicle[], raw: unknown): IrissFetchedVehicle[] {
  if (vehicles.length === 0) return vehicles;
  const hints = auto1VinHintsFromRaw(raw);
  if (hints.size === 0) {
    return vehicles.map((v) => {
      if (v.vin) return v;
      const fromUrl = extractIso3779VinFromUrls([v.imageUrl, ...(v.imageUrls ?? [])]);
      return fromUrl ? { ...v, vin: fromUrl, vinSource: "source" as const } : v;
    });
  }
  return vehicles.map((v) => {
    const hint = hints.get(v.externalId) || hints.get(v.stockNumber ?? "");
    const documentImageUrls = [...new Set([...(v.documentImageUrls ?? []), ...(hint?.documentImageUrls ?? [])])];
    const vin =
      v.vin ||
      hint?.vin ||
      extractIso3779VinFromUrls([v.imageUrl, ...(v.imageUrls ?? []), ...documentImageUrls]);
    if (vin === (v.vin ?? "") && documentImageUrls.length === (v.documentImageUrls?.length ?? 0)) return v;
    return {
      ...v,
      ...(vin ? { vin, vinSource: v.vinSource ?? "source" } : {}),
      ...(documentImageUrls.length ? { documentImageUrls } : {}),
    };
  });
}
