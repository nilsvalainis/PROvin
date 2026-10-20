/**
 * Radara (IRISS SCAN) lauki / saglabātie meklēšanas URL -> tirgus vaicājums.
 * Pasūtījumu stingrie cenas vārti šeit nav. Nobraukums tikai km.
 */

import { parseEnginePowerKwFromText } from "@/lib/engine-power-kw";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { mapEngineCc } from "@/lib/iriss-listings-ecarstrade-criteria";
import { irissScanOrderId } from "@/lib/iriss-scan-listings";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";
import {
  type MarketplaceOrderCriteria,
  marketplaceQueryFromOrder,
  marketplaceMissingFieldsMessage,
} from "@/lib/marketplace/query-from-order";
import { inferMarketplaceVehicleCategory } from "@/lib/marketplace/search-urls";
import {
  MARKETPLACE_TOO_BROAD_ERROR,
  isMarketplaceVehicleCategory,
  marketplaceQueryHasRadarBounds,
  marketplaceQueryHasRadarExtraRange,
  type MarketplacePlatform,
  type MarketplaceQuery,
} from "@/lib/marketplace/types";

export function irissScanMarketplaceOwnerId(scanId: string): string {
  return irissScanOrderId(scanId);
}

export function irissScanApifyPlatforms(rec: Pick<IrissScanRecord, "apifyMobiledeEnabled" | "apifyAutoscout24Enabled">): MarketplacePlatform[] {
  const out: MarketplacePlatform[] = [];
  if (rec.apifyMobiledeEnabled) out.push("mobilede");
  if (rec.apifyAutoscout24Enabled) out.push("autoscout24");
  return out;
}

export function marketplaceOrderCriteriaFromScan(rec: IrissScanRecord): MarketplaceOrderCriteria {
  return {
    brandModel: rec.brandModel,
    productionYears: rec.productionYears,
    engineType: rec.engineType,
    transmission: rec.transmission,
    bodyType: rec.bodyType,
  };
}

function fold(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function litersToCc(raw: string): number | null {
  const m = raw.replace(",", ".").match(/\b(\d)\.(\d)\b/);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10) * 1000 + Number.parseInt(m[2] ?? "", 10) * 100;
  return n >= 600 && n <= 9000 ? n : null;
}

/** "no 110 kW / 150 ZS" -> from only; "līdz 2.0 (1950 cm3)" -> cc to. */
export function applyOpenEndedEngineBounds(q: MarketplaceQuery, engineType: string): void {
  const text = engineType.replace(/\u00a0/g, " ").trim();
  if (!text) return;
  const folded = fold(text);
  const kw = parseEnginePowerKwFromText(text);
  if (kw != null && /\bno\s+\d|\bfrom\s+\d|\bmin\s+\d|\bab\s+\d/.test(folded)) {
    q.powerFromKw = kw;
    q.powerToKw = null;
  }
  if (/\b(?:lidz|līdz|max|bis|until)\b/.test(folded)) {
    const liters = litersToCc(text);
    if (liters != null) {
      q.displacementToCc = liters;
      q.displacementFromCc = null;
    } else {
      const cc = mapEngineCc(text);
      if (cc != null) {
        q.displacementToCc = cc;
        q.displacementFromCc = null;
      }
    }
  }
}

function parseColonRange(raw: string | null): { from: number | null; to: number | null } {
  if (!raw) return { from: null, to: null };
  const [a, b] = raw.split(":");
  const from = a && /^\d+$/.test(a) ? Number.parseInt(a, 10) : null;
  const to = b && /^\d+$/.test(b) ? Number.parseInt(b, 10) : null;
  return { from: Number.isFinite(from) ? from : null, to: Number.isFinite(to) ? to : null };
}

function takeInt(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function overlayMarketplaceQueryFromSearchUrl(q: MarketplaceQuery, rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  const host = url.hostname.toLowerCase();
  const p = url.searchParams;
  if (host.includes("mobile.de")) {
    const vc = (p.get("vc") || p.get("s") || "").toLowerCase();
    if (vc === "van") q.vehicleCategory = "van";
    if (vc === "car") q.vehicleCategory = "car";
    const years = parseColonRange(p.get("fr"));
    if (q.yearFrom == null && years.from != null) q.yearFrom = years.from;
    if (q.yearTo == null && years.to != null) q.yearTo = years.to;
    const km = parseColonRange(p.get("ml"));
    if (q.mileageFrom == null && km.from != null) q.mileageFrom = km.from;
    if (q.mileageTo == null && km.to != null) q.mileageTo = km.to;
    const cc = parseColonRange(p.get("cc"));
    if (q.displacementFromCc == null && cc.from != null) q.displacementFromCc = cc.from;
    if (q.displacementToCc == null && cc.to != null) q.displacementToCc = cc.to;
    const pw = parseColonRange(p.get("pw"));
    if (q.powerFromKw == null && pw.from != null) q.powerFromKw = pw.from;
    if (q.powerToKw == null && pw.to != null) q.powerToKw = pw.to;
    const ft = (p.get("ft") || "").toUpperCase();
    if (!q.fuel && ft === "DIESEL") q.fuel = "diesel";
    const tr = (p.get("tr") || "").toUpperCase();
    if (!q.gearbox && tr.includes("MANUAL")) q.gearbox = "manual";
    if (!q.gearbox && tr.includes("AUTOMATIC")) q.gearbox = "automatic";
    if ((p.get("fe") || "").toUpperCase().includes("AIR_CONDITIONING") && !q.features.includes("air_conditioning")) {
      q.features.push("air_conditioning");
    }
  }
  if (host.includes("autoscout24")) {
    const atype = (p.get("atype") || "").toUpperCase();
    if (atype === "X") q.vehicleCategory = "van";
    if (atype === "C") q.vehicleCategory = "car";
    const yFrom = takeInt(p.get("fregfrom"));
    const yTo = takeInt(p.get("fregto"));
    if (q.yearFrom == null && yFrom != null) q.yearFrom = yFrom;
    if (q.yearTo == null && yTo != null) q.yearTo = yTo;
    const kmFrom = takeInt(p.get("kmfrom"));
    const kmTo = takeInt(p.get("kmto"));
    if (q.mileageFrom == null && kmFrom != null) q.mileageFrom = kmFrom;
    if (q.mileageTo == null && kmTo != null) q.mileageTo = kmTo;
    const ccFrom = takeInt(p.get("ccfrom"));
    const ccTo = takeInt(p.get("ccto"));
    if (q.displacementFromCc == null && ccFrom != null) q.displacementFromCc = ccFrom;
    if (q.displacementToCc == null && ccTo != null) q.displacementToCc = ccTo;
    const pwFrom = takeInt(p.get("powerfrom"));
    const pwTo = takeInt(p.get("powerto"));
    if (q.powerFromKw == null && pwFrom != null) q.powerFromKw = pwFrom;
    if (q.powerToKw == null && pwTo != null) q.powerToKw = pwTo;
    if (!q.fuel && (p.get("fuel") || "").toUpperCase() === "D") q.fuel = "diesel";
    if (!q.gearbox && (p.get("gear") || "").toUpperCase() === "M") q.gearbox = "manual";
    if (!q.gearbox && (p.get("gear") || "").toUpperCase() === "A") q.gearbox = "automatic";
    if ((p.get("eq") || "").split(",").includes("5") && !q.features.includes("air_conditioning")) {
      q.features.push("air_conditioning");
    }
    const cy = (p.get("cy") || "").split(/[+,]/).map((s) => s.trim()).filter(Boolean);
    if (!q.countries.length && cy.length) q.countries = cy.slice(0, 8);
  }
}

function hasAirConText(...parts: string[]): boolean {
  return parts.some((p) => /kondicion|air.?cond|\ba\/?c\b|klima/i.test(p));
}

export function marketplaceQueryFromScan(rec: IrissScanRecord): MarketplaceQuery {
  const q = marketplaceQueryFromOrder(marketplaceOrderCriteriaFromScan(rec));
  applyOpenEndedEngineBounds(q, rec.engineType);
  if (isMarketplaceVehicleCategory(rec.vehicleCategory)) {
    q.vehicleCategory = rec.vehicleCategory;
  } else {
    q.vehicleCategory = inferMarketplaceVehicleCategory(rec.bodyType, q.model, q.make);
  }
  if (hasAirConText(rec.brandModel, rec.engineType, rec.bodyType) && !q.features.includes("air_conditioning")) {
    q.features.push("air_conditioning");
  }
  for (const url of [...filledIrissListingLinks(rec.listingLinkMobile), ...filledIrissListingLinks(rec.listingLinksOther)]) {
    overlayMarketplaceQueryFromSearchUrl(q, url);
  }
  if (rec.vehicleCategory && isMarketplaceVehicleCategory(rec.vehicleCategory)) {
    q.vehicleCategory = rec.vehicleCategory;
  }
  return q;
}

export const MARKETPLACE_RADAR_FIELD_LABELS = {
  make: "marka",
  model: "modelis",
  yearFrom: "gadi no",
  yearTo: "gadi līdz",
} as const;

export function marketplaceRadarMissingFields(rec: IrissScanRecord): string[] {
  const q = marketplaceQueryFromScan(rec);
  const missing: string[] = [];
  if (!q.make.trim()) missing.push(MARKETPLACE_RADAR_FIELD_LABELS.make);
  if (!q.model.trim()) missing.push(MARKETPLACE_RADAR_FIELD_LABELS.model);
  if (q.yearFrom == null) missing.push(MARKETPLACE_RADAR_FIELD_LABELS.yearFrom);
  if (q.yearTo == null) missing.push(MARKETPLACE_RADAR_FIELD_LABELS.yearTo);
  if (q.yearFrom != null && q.yearTo != null && q.yearFrom > q.yearTo) {
    if (!missing.includes(MARKETPLACE_RADAR_FIELD_LABELS.yearFrom)) missing.push(MARKETPLACE_RADAR_FIELD_LABELS.yearFrom);
    if (!missing.includes(MARKETPLACE_RADAR_FIELD_LABELS.yearTo)) missing.push(MARKETPLACE_RADAR_FIELD_LABELS.yearTo);
  }
  return missing;
}

export const MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE =
  "Vēl vajag vienu no: nobraukums līdz (km), tilpums vai jauda.";

export function marketplaceRadarExtraRangeMissing(rec: IrissScanRecord): boolean {
  return !marketplaceQueryHasRadarExtraRange(marketplaceQueryFromScan(rec));
}

export function marketplaceScanHasFetchBounds(rec: IrissScanRecord): boolean {
  return marketplaceQueryHasRadarBounds(marketplaceQueryFromScan(rec));
}

export function marketplaceRadarTooBroadSkipReason(rec: IrissScanRecord | null): string {
  if (!rec) return "nav kritēriju";
  const missing = marketplaceRadarMissingFields(rec);
  const extra = marketplaceRadarExtraRangeMissing(rec);
  if (!missing.length && !extra) return "";
  if (missing.length && extra) {
    return `${MARKETPLACE_TOO_BROAD_ERROR} (trūkst: ${missing.join(", ")}). ${MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE}`;
  }
  if (missing.length) return `${MARKETPLACE_TOO_BROAD_ERROR} (trūkst: ${missing.join(", ")})`;
  return `${MARKETPLACE_TOO_BROAD_ERROR}. ${MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE}`;
}

export function marketplaceRadarMissingFieldsMessage(missing: readonly string[]): string {
  return marketplaceMissingFieldsMessage(missing);
}
