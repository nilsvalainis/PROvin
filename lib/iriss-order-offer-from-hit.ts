import { listingFmtEur } from "@/lib/iriss-listings-card";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { irissListingVin } from "@/lib/iriss-pasutijums-from-listing";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";
import { orderRoomHitStockNo } from "@/lib/iriss-order-room-hit-pricing";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";

export type IrissOfferFromHitSeed = Pick<
  IrissOfferRecord,
  | "brandModel"
  | "vin"
  | "year"
  | "mileage"
  | "priceGermany"
  | "firstRegistration"
  | "odometerReading"
  | "transmission"
  | "location"
  | "carPrice"
  | "fuel"
  | "driveType"
  | "powerKw"
  | "engineDisplacement"
  | "color"
  | "bodyTypeOffer"
  | "doorCount"
  | "emissionClass"
  | "originCountry"
  | "auctionPlatform"
  | "auctionStockNumber"
  | "auctionEndAt"
  | "vatStatus"
  | "damageGrade"
  | "equipmentHighlights"
  | "estimatedTotalPrice"
>;

function inferDrive(title: string, bodyType: string): string {
  const hay = `${title} ${bodyType}`.toLowerCase();
  if (/\bquattro\b|\b4x4\b|\bawd\b|\b4matic\b|\bxdrive\b/.test(hay)) return "quattro / 4x4";
  return "";
}

function formatVatStatus(hit: IrissOrderRoomHit): string {
  if (hit.isMargin) return "Marža";
  if (hit.taxDeduction) return "Ar atskaitāmu PVN";
  if (hit.vatNote.trim()) return hit.vatNote.trim();
  return "";
}

function formatAuctionEnd(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t.slice(0, 40);
  return new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" }).format(d);
}

/** Aizpilda piedāvājuma laukus no istabas hit (bez foto importa). */
export function irissOfferSeedFromHit(hit: IrissOrderRoomHit): IrissOfferFromHitSeed {
  const year = hit.year || (hit.firstRegistration.match(/(?:19|20)\d{2}/)?.[0] ?? "");
  const mileage = hit.mileageKm != null ? String(Math.round(hit.mileageKm)) : "";
  const priceNum = hit.price ?? hit.priceCurrent ?? hit.priceBuyNow;
  const price = priceNum != null ? String(Math.round(priceNum)) : "";
  const total = hit.priceTotal != null ? listingFmtEur(hit.priceTotal) : "";
  return {
    brandModel: hit.title,
    vin: irissListingVin(hit.vin),
    year,
    mileage,
    priceGermany: price,
    firstRegistration: hit.firstRegistration || year,
    odometerReading: mileage,
    transmission: hit.transmission,
    location: hit.location,
    carPrice: price,
    fuel: hit.fuel,
    driveType: inferDrive(hit.title, hit.bodyType),
    powerKw: hit.powerKw,
    engineDisplacement: "",
    color: hit.color,
    bodyTypeOffer: hit.bodyType,
    doorCount: "",
    emissionClass: "",
    originCountry: hit.countryCode || "",
    auctionPlatform: IRISS_LISTING_PLATFORM_LABEL[hit.platform] ?? hit.platform,
    auctionStockNumber: orderRoomHitStockNo(hit),
    auctionEndAt: formatAuctionEnd(hit.auctionEndAt),
    vatStatus: formatVatStatus(hit),
    damageGrade: "",
    equipmentHighlights: "",
    estimatedTotalPrice: total,
  };
}
