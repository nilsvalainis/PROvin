/**
 * LIST kartīte → IRISS pasūtījuma sākuma dati. Nenorāda tukšus aktīvus ierakstus:
 * vienmēr ir marka, saite un (ja ir) VIN.
 */

import { emptyIrissPasutijums, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

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
  return isValidVin(v) ? v : "";
}

export function irissPasutijumsSeedFromListing(
  v: IrissListingOrderSeedInput,
  id: string,
  nowIso: string,
): IrissPasutijumsRecord {
  const rec = emptyIrissPasutijums(id, nowIso);
  const brand = [v.manufacturer, v.title].map((s) => (s ?? "").trim()).filter(Boolean);
  rec.brandModel = brand[0] && brand[1] && brand[1].toLowerCase().includes(brand[0].toLowerCase()) ? brand[1] : brand.join(" ").trim() || v.title.trim();
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
