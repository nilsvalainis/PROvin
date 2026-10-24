/**
 * Piedāvājuma sākuma dati no Autoparka vai Loģistikas auto (tīra loģika).
 * Visi lauki rediģējami; importētie formā ar zaļu punktu. Autoparka cena paliek TUKŠA (Nila atbilde 4),
 * tāpēc summas (ap_summas) no Autoparka netiek dotas nekad.
 */

import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { V2_VAT_MODE_LV, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import type { OfferDraft } from "@/lib/iriss-offer-draft";

export type OfferSeedFields = Partial<
  Pick<
    OfferDraft,
    | "brandModel"
    | "vin"
    | "firstRegistration"
    | "year"
    | "odometerReading"
    | "mileage"
    | "fuel"
    | "transmission"
    | "powerKw"
    | "engineDisplacement"
    | "color"
    | "location"
    | "equipmentHighlights"
    | "auctionPlatform"
    | "auctionStockNumber"
    | "vatStatus"
    | "carPrice"
    | "priceGermany"
  >
>;

/** Lauki, kurus formā atzīmē ar zaļo punktu (sakrīt ar formas lauku atslēgām). */
export const OFFER_SEED_TAG_KEYS = [
  "brandModel",
  "vin",
  "firstRegistration",
  "odometerReading",
  "fuel",
  "transmission",
  "powerKw",
  "engineDisplacement",
  "color",
  "location",
  "equipmentHighlights",
  "auctionPlatform",
  "auctionStockNumber",
  "vatStatus",
  "carPrice",
] as const;

export type AutoparksSeedExtras = {
  tech?: { firstRegDate?: string; displacementCm3?: number | null; powerKw?: number | null } | null;
  /** Iepirkuma dati (izsole, Lot/stock nr., PVN režīms) - Autoparka v2 `purchase`. */
  purchase?: { auction?: string; auctionNo?: string; vat?: { mode?: V2VatMode } } | null;
  location?: string;
  displayName?: string;
  equipmentLine?: string;
};

const KM = new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0, useGrouping: true });

function km(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? `${KM.format(Math.round(n)).replace(/\s/g, " ")} km` : "";
}

function num(n: number | null | undefined, unit: string): string {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? `${Math.round(n)} ${unit}` : "";
}

function txt(v: unknown, max = 160): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function compact(fields: Record<string, string>): OfferSeedFields {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) if (v) out[k] = v;
  return out as OfferSeedFields;
}

export function offerSeedFromAutoparks(car: AutoparksCar, extras: AutoparksSeedExtras = {}): OfferSeedFields {
  const reg = car.registry;
  const makeModel = txt(extras.displayName) || txt(car.displayName) || txt(`${car.make} ${car.model}`) || txt(reg?.makeModel);
  const firstReg = txt(extras.tech?.firstRegDate) || txt(reg?.firstRegDate) || txt(car.year, 40);
  const odometer = km(reg?.odometerKm ?? null) || km(car.mileageKm);
  const vatMode = extras.purchase?.vat?.mode;
  return compact({
    brandModel: makeModel,
    vin: txt(car.vin, 32).toUpperCase(),
    firstRegistration: firstReg,
    year: firstReg,
    odometerReading: odometer,
    mileage: odometer,
    fuel: txt(reg?.fuel, 60),
    transmission: txt(reg?.gearbox, 60),
    powerKw: num(extras.tech?.powerKw, "kW"),
    engineDisplacement: num(extras.tech?.displacementCm3, "cm³"),
    color: txt(car.color, 60),
    location: txt(extras.location) || txt(car.location),
    equipmentHighlights: txt(extras.equipmentLine, 600) || txt(car.equipmentLine, 600),
    auctionPlatform: txt(extras.purchase?.auction, 80),
    auctionStockNumber: txt(extras.purchase?.auctionNo, 80),
    vatStatus: vatMode ? txt(V2_VAT_MODE_LV[vatMode], 40) : "",
  });
}

/** hideSums - darbinieks, kuram Loģistikā summas paslēptas (loma logistika/serviss): cena netiek dota. */
export function offerSeedFromLogistics(order: LogisticsOrder, opts: { hideSums?: boolean } = {}): OfferSeedFields {
  const parsed = order.listingParsed;
  const makeModel = txt(`${order.make} ${order.model}`) || txt(order.title) || txt(`${parsed?.make ?? ""} ${parsed?.model ?? ""}`);
  const price = order.priceEur ?? parsed?.priceEur ?? null;
  const priceText =
    !opts.hideSums && typeof price === "number" && Number.isFinite(price) && price > 0 ? String(Math.round(price)) : "";
  const odometer = km(order.mileageKm ?? parsed?.mileageKm ?? null);
  return compact({
    brandModel: makeModel,
    vin: (txt(order.vin, 32) || txt(parsed?.vin, 32)).toUpperCase(),
    odometerReading: odometer,
    mileage: odometer,
    auctionPlatform: order.auction && order.auction !== "cits" ? order.auction : "",
    auctionStockNumber: txt(order.stockNo, 80),
    carPrice: priceText,
    priceGermany: priceText,
    location: txt(parsed?.address),
  });
}

export function offerSeedTaggedKeys(fields: OfferSeedFields): string[] {
  return OFFER_SEED_TAG_KEYS.filter((k) => Boolean(fields[k]));
}
