/**
 * Sludinājums -> Piedāvājums (Nils 29.10: Sludinājumu loģika jāsasaista ar jauno Piedāvājumu sadaļu).
 * Agrāk «Nosūtīt klientam» izveidoja jaunu Pasūtījumu ar veco piedāvājuma bloku; tagad - piedāvājuma melnrakstu
 * ar auto datiem, bildēm (caur mūsu starpniekceļu) un pirkuma cenu, piesaistītu klienta pasūtījumam.
 */

import { listingVinCardState } from "@/lib/iriss-listings-card";
import { countryNameLv } from "@/lib/iriss-listings-country-flag";
import { listingBidPrice } from "@/lib/iriss-listings-cost";
import { resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";
import { LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-panel";
import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";
import { irissPdPhotosFromUrls, type IrissPdImport } from "@/lib/iriss-piedavajumi-import";
import { type IrissPdPhoto, type IrissPdSource, type IrissPdVehicle } from "@/lib/iriss-piedavajumi-types";

export const IRISS_PD_SOURCE_FROM_LISTING: Record<IrissListingPlatform, IrissPdSource> = {
  auto1: "auto1",
  openline: "openlane",
  autobid: "autobid",
  ecarstrade: "ecarstrade",
  mobilede: "mobilede",
  autoscout24: "autoscout24",
};

/** Piedāvājuma `sourceRef` sludinājumam - pēc tā Sludinājumos atrod jau izveidotos piedāvājumus. */
export function irissPdListingRef(listingId: string): string {
  return `listing:${listingId}`;
}

function yearOf(v: Pick<IrissListingVehicle, "year" | "firstRegistration">): string {
  const m = `${v.year} ${v.firstRegistration}`.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return m ? m[1]! : "";
}

function listingPhotos(v: Pick<IrissListingVehicle, "imageUrl" | "imageUrls">): IrissPdPhoto[] {
  return irissPdPhotosFromUrls([v.imageUrl, ...(v.imageUrls ?? [])]);
}

export function irissPdImportFromListing(v: IrissListingVehicle): IrissPdImport {
  const vin = listingVinCardState(v)?.vin ?? "";
  const vehicle: IrissPdVehicle = {
    title: v.title.trim().slice(0, 160),
    vin,
    year: yearOf(v),
    firstRegistration: v.firstRegistration.trim(),
    mileageKm: v.mileageKm != null && v.mileageKm > 0 ? String(Math.round(v.mileageKm)) : "",
    fuel: v.fuel.trim(),
    transmission: v.transmission.trim(),
    powerKw: String(v.powerKw ?? "").replace(/[^\d]/g, "").slice(0, 4),
    engine: "",
    color: (v.color ?? "").trim(),
    body: (v.bodyType ?? "").trim(),
    location: v.countryCode ? countryNameLv(v.countryCode) : "",
  };
  const bid = listingBidPrice(v);
  const fieldCount = Object.values(vehicle).filter((x) => x.trim()).length;
  const label = LISTING_PLATFORM_LABEL[v.platform] ?? v.platform;
  const stock = (v.stockNumber ?? "").trim();
  return {
    source: IRISS_PD_SOURCE_FROM_LISTING[v.platform] ?? "manual",
    sourceRef: irissPdListingRef(v.id),
    sourceUrl: resolveListingDetailUrl(v) || v.detailUrl,
    sourceKey: v.externalId,
    vehicle,
    photos: listingPhotos(v),
    price: "",
    purchasePrice: bid != null && bid > 0 ? String(Math.round(bid)) : "",
    auto1: null,
    fieldCount,
    historyText: `Izveidots no Sludinājumiem (${label}${stock ? `, Nr. ${stock}` : ""}) · ${fieldCount} lauki`,
    note: "",
  };
}
