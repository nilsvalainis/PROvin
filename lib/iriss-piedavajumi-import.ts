/**
 * j70: importa dati -> piedāvājuma auto lauki (tīra loģika). Visi lauki pēc tam rediģējami.
 */

import type { IrissAuctionDetailExtras } from "@/lib/iriss-auction-detail";
import type { OfferSeedFields } from "@/lib/iriss-offer-seed";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { emptyIrissPdVehicle, IRISS_PD_MAX_PHOTOS, type IrissPdPhoto, type IrissPdSource, type IrissPdVehicle } from "@/lib/iriss-piedavajumi-types";

const s = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

export function irissPdVehicleFromSeed(f: OfferSeedFields): IrissPdVehicle {
  return {
    ...emptyIrissPdVehicle(),
    title: s(f.brandModel),
    vin: s(f.vin).toUpperCase(),
    year: s(f.year),
    firstRegistration: s(f.firstRegistration),
    mileageKm: s(f.odometerReading) || s(f.mileage),
    fuel: s(f.fuel),
    transmission: s(f.transmission),
    powerKw: s(f.powerKw),
    engine: s(f.engineDisplacement),
    color: s(f.color),
    body: s(f.bodyTypeOffer),
  };
}

export function irissPdVehicleFromHit(hit: IrissOrderRoomHit, extras: IrissAuctionDetailExtras | null): IrissPdVehicle {
  return {
    ...emptyIrissPdVehicle(),
    title: s(hit.title),
    vin: s(hit.vin).toUpperCase(),
    year: s(hit.year),
    firstRegistration: s(hit.firstRegistration),
    mileageKm: hit.mileageKm != null && hit.mileageKm > 0 ? String(Math.round(hit.mileageKm)) : "",
    fuel: s(hit.fuel),
    transmission: s(hit.transmission),
    powerKw: s(hit.powerKw),
    engine: s(extras?.engineDisplacement),
    color: s(hit.color),
    body: s(hit.bodyType),
  };
}

/** Izsoles bildes (bez dublikātiem, līdz 60). */
export function irissPdPhotosFromUrls(urls: readonly string[]): IrissPdPhoto[] {
  const out: IrissPdPhoto[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const t = raw.trim();
    if (!/^https:\/\//i.test(t) || t.length > 2000) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind: "url", url: t });
    if (out.length >= IRISS_PD_MAX_PHOTOS) break;
  }
  return out;
}

export function irissPdFilledCount(v: IrissPdVehicle): number {
  return Object.values(v).filter((x) => x.trim()).length;
}

/** Izsoles cena -> iekšējā iepirkuma cena (klients to neredz). */
export function irissPdPurchaseFromHit(hit: Pick<IrissOrderRoomHit, "priceBuyNow" | "priceCurrent" | "price">): string {
  const n = hit.priceBuyNow ?? hit.priceCurrent ?? hit.price;
  return n != null && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
}

export type IrissPdImport = {
  source: IrissPdSource;
  sourceRef: string;
  sourceUrl: string;
  sourceKey: string;
  vehicle: IrissPdVehicle;
  photos: IrissPdPhoto[];
  price: string;
  purchasePrice: string;
  auto1: IrissPdAuto1Blocks | null;
  fieldCount: number;
  /** Vēstures teksts «Izveidots no Auto1 saites · 22 lauki». */
  historyText: string;
  /** Brīdinājums UI (piem. bildes nav, stub). */
  note: string;
};

/**
 * Pieprasījumu (vai tukšu melnrakstu) aizpilda ar importu: auto, foto, avots, Auto1 bloki.
 * Klients, termiņš un statuss paliek; cena tikai, ja vēl nav ievadīta.
 */
export function applyIrissPdImportData<T extends {
  source: IrissPdSource;
  sourceRef: string;
  sourceUrl: string;
  sourceKey: string;
  importedFieldCount: number;
  vehicle: IrissPdVehicle;
  photos: IrissPdPhoto[];
  price: string;
  purchasePrice: string;
  auto1: IrissPdAuto1Blocks | null;
  auto1ImportedAt: string;
}>(rec: T, imp: IrissPdImport, at: string): T {
  return {
    ...rec,
    source: imp.source,
    sourceRef: imp.sourceRef,
    sourceUrl: imp.sourceUrl,
    sourceKey: imp.sourceKey,
    importedFieldCount: imp.fieldCount,
    vehicle: imp.vehicle,
    photos: imp.photos,
    price: rec.price.trim() ? rec.price : imp.price,
    purchasePrice: imp.purchasePrice || rec.purchasePrice,
    auto1: imp.auto1,
    auto1ImportedAt: imp.auto1 ? at : "",
  };
}
