/**
 * LIST kartīte → IRISS pasūtījuma sākuma dati. Nenorāda tukšus aktīvus ierakstus:
 * vienmēr ir marka, saite un (ja ir) VIN.
 */

import { listingFmtEur } from "@/lib/iriss-listings-card";
import { listingBidPrice } from "@/lib/iriss-listings-cost";
import { listingBrandModelLabel } from "@/lib/iriss-listing-search-fields";
import { defaultOfferValidUntilYmd } from "@/lib/iriss-offer-valid-until";
import { emptyIrissOfferRecord, emptyIrissPasutijums, type IrissOfferRecord, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";
import { isPlausibleListingVin } from "@/lib/iriss-listings-extract";
import { normalizeVin } from "@/lib/order-field-validation";

export type IrissListingOrderSeedInput = Pick<
  IrissListingVehicle,
  "id" | "title" | "manufacturer" | "year" | "firstRegistration" | "mileageKm" | "fuel" | "transmission" | "powerKw" | "vin" | "detailUrl" | "platform" | "color" | "bodyType"
>;

function listingLinkField(platform: IrissListingPlatform): keyof Pick<
  IrissPasutijumsRecord,
  "listingLinkAutobid" | "listingLinkOpenline" | "listingLinkAuto1" | "listingLinkEcarstrade"
> {
  if (platform === "openline") return "listingLinkOpenline";
  if (platform === "auto1") return "listingLinkAuto1";
  if (platform === "ecarstrade") return "listingLinkEcarstrade";
  return "listingLinkAutobid";
}

export function irissListingVin(raw: string | undefined): string {
  const v = normalizeVin(raw ?? "");
  return isPlausibleListingVin(v) ? v : "";
}

export function irissPasutijumsSeedFromListing(
  v: IrissListingOrderSeedInput,
  id: string,
  nowIso: string,
): IrissPasutijumsRecord {
  const rec = emptyIrissPasutijums(id, nowIso);
  rec.brandModel = listingBrandModelLabel(v);
  rec.vin = irissListingVin(v.vin);
  rec.productionYears = (v.year || "").trim();
  rec.engineType = [v.fuel, v.powerKw].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  rec.transmission = (v.transmission || "").trim();
  rec.bodyType = (v.bodyType || "").trim();
  rec.maxMileage = v.mileageKm != null && v.mileageKm > 0 ? String(v.mileageKm) : "";
  rec.preferredColors = (v.color || "").trim();
  rec.listStatus = "active";
  const href = (v.detailUrl || "").trim();
  if (href) rec[listingLinkField(v.platform)] = [href];
  return rec;
}

export function irissOfferSeedFromListing(
  v: IrissListingOrderSeedInput & Pick<IrissListingVehicle, "priceCurrent" | "priceStart" | "priceBuyNow" | "priceMinimal" | "location">,
  id: string,
  nowIso: string,
): IrissOfferRecord {
  const offer = emptyIrissOfferRecord(id, nowIso, "Piedāvājums 1");
  const rec = irissPasutijumsSeedFromListing(v, "tmp", nowIso);
  const bid = listingBidPrice(v);
  offer.brandModel = rec.brandModel;
  offer.vin = rec.vin;
  offer.year = rec.productionYears;
  offer.firstRegistration = (v.firstRegistration || rec.productionYears || "").trim();
  offer.mileage = rec.maxMileage;
  offer.odometerReading = rec.maxMileage;
  offer.transmission = rec.transmission;
  offer.location = (v.location || "").trim();
  offer.carPrice = bid != null ? listingFmtEur(bid) : "";
  offer.priceGermany = offer.carPrice;
  offer.validUntil = defaultOfferValidUntilYmd(Date.parse(nowIso) || Date.now());
  return offer;
}

export function irissPasutijumsOfferSeedFromListing(
  v: IrissListingOrderSeedInput & Pick<IrissListingVehicle, "priceCurrent" | "priceStart" | "priceBuyNow" | "priceMinimal" | "location">,
  id: string,
  nowIso: string,
  offerId: string,
): IrissPasutijumsRecord {
  const rec = irissPasutijumsSeedFromListing(v, id, nowIso);
  rec.listStatus = "offered";
  rec.offers = [irissOfferSeedFromListing(v, offerId, nowIso)];
  return rec;
}
