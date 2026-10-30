/**
 * IRISS pasūtījuma istaba: jau nolasīto Meklētāja trāpījumu kārtošana, kritēriji, piedāvājumi.
 * Šis modulis neko neielādē no maksas avotiem un neizsauc sync.
 */

import { auctionPhotoUrlsFromHit } from "@/lib/iriss-auction-offer-photos";
import { offerImageGridSrc, orderOfferAttachmentsForPdf } from "@/lib/iriss-offer-image-sorter";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { listingFmtEur } from "@/lib/iriss-listings-card";
import { listingComparisonPrice } from "@/lib/iriss-listings-cost";
import { listingMatchesOrderMakeModel } from "@/lib/iriss-listing-order-gate";
import {
  bodiesMatchGroups,
  colorsMatchGroups,
  drivesMatchGroups,
  fuelsMatchGroups,
  gearboxesMatchGroups,
} from "@/lib/iriss-criteria-listing-match";
import { acceptedNormalization, normalizeDrive } from "@/lib/iriss-criteria-taxonomy";
import { listingVehicleOrderIds, parseIrissOrderBudget } from "@/lib/iriss-listings-orders";
import { splitModelExtensions, titleHasAnyModelExtension } from "@/lib/iriss-model-extension";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform, IrissListingPriceChange, IrissListingVehicleChange } from "@/lib/iriss-listings-types";
import { irissListingVin } from "@/lib/iriss-pasutijums-from-listing";
import {
  displayIrissPasutijumsListStatusLabel,
  IRISS_DEAL_DETAIL_OPTIONS,
  type IrissOfferRecord,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

export const IRISS_ORDER_ROOM_TABS = ["overview", "search", "offers", "communication", "documents"] as const;
export type IrissOrderRoomTab = (typeof IRISS_ORDER_ROOM_TABS)[number];

export const IRISS_ORDER_ROOM_HIT_BUCKETS = ["new", "saved", "offered", "reject"] as const;
export type IrissOrderRoomHitBucket = (typeof IRISS_ORDER_ROOM_HIT_BUCKETS)[number];

export type IrissOrderRoomHit = {
  id: string;
  platform: IrissListingPlatform;
  externalId: string;
  detailUrl: string;
  orderIds: string[];
  title: string;
  year: string;
  firstRegistration: string;
  mileageKm: number | null;
  fuel: string;
  transmission: string;
  powerKw: string;
  color: string;
  bodyType: string;
  /** Jau sludinājumā nolasīts, bet iepriekš šeit nepārnests (j41b). Piemēram "5" vai "5/5". */
  doorCount?: string;
  /** Avota (Auto1/Openlane/Autobid) raw bojājumu/stāvokļa teksts - nepārtulkots, sk. iriss-auction-listing-field-map.ts. */
  damageRaw?: string;
  /** Auto1 pārdevēja valsts; ne vienmēr tas pats, kas countryCode. */
  sourceCountry?: string;
  imageUrl: string;
  imageUrls: string[];
  thumbUrl?: string;
  imageCount: number;
  vin: string;
  price: number | null;
  priceStart: number | null;
  priceMinimal: number | null;
  priceCurrent: number | null;
  priceBuyNow: number | null;
  priceEstimate: number | null;
  priceTotal: number | null;
  stockNumber: string;
  auctionId: string;
  auctionStage: string;
  auctionStartAt: string;
  auctionEndAt: string;
  countryCode: string;
  vatNote: string;
  salesVatType?: number | null;
  isMargin?: boolean | null;
  taxDeduction?: boolean | null;
  vatRate?: number | null;
  bidCount?: number | null;
  change: IrissListingVehicleChange;
  firstSeenAt: string;
  lastSeenAt: string;
  location: string;
  priceHistory: IrissListingPriceChange[];
  sourceLinks?: Array<{ platform: IrissListingPlatform; url: string }>;
};

export type IrissOrderRoomHitSource = {
  id: string;
  platform: IrissListingPlatform;
  externalId: string;
  detailUrl: string;
  orderIds: readonly string[];
  title: string;
  manufacturer?: string;
  year?: string;
  firstRegistration?: string;
  mileageKm?: number | null;
  fuel?: string;
  transmission?: string;
  powerKw?: string;
  color?: string;
  bodyType?: string;
  doorCount?: string;
  damageRaw?: string;
  sourceCountry?: string;
  imageUrl?: string;
  imageUrls?: string[];
  vin?: string;
  priceStart?: number | null;
  priceMinimal?: number | null;
  priceCurrent?: number | null;
  priceBuyNow?: number | null;
  priceEstimate?: number | null;
  change?: IrissListingVehicleChange;
  firstSeenAt?: string;
  location?: string;
  priceHistory?: IrissListingPriceChange[];
  sourceLinks?: Array<{ platform: IrissListingPlatform; url: string }>;
};

export type IrissOrderRoomCheck = { id: string; label: string; pass: boolean };

export type IrissOrderRoomMatch = {
  percent: number | null;
  badges: IrissOrderRoomCheck[];
};

export type IrissOrderRoomChip = { id: string; label: string; tone: "neutral" | "required" };

export type IrissOrderRoomOfferSeed = {
  brandModel: string;
  vin: string;
  year: string;
  mileage: string;
  price: string;
  transmission: string;
  firstRegistration: string;
  photoUrls: string[];
};

export type IrissOrderRoomNextStep = { id: string; label: string; tab: IrissOrderRoomTab };

export const IRISS_ORDER_ROOM_TEMPLATES = [
  {
    id: "deposit",
    label: "Avansa apstiprinājums",
    text: "Sveiki! Apstiprinu saņemto avansu. Turpinām meklēšanu pēc Jūsu kritērijiem.",
  },
  {
    id: "offer",
    label: "Jauns piedāvājums",
    text: "Sveiki! Sagatavoju jaunu piedāvājumu. Varu nosūtīt kopsavilkumu WhatsApp vai e-pastā.",
  },
  {
    id: "reserve",
    label: "Rezervācija",
    text: "Sveiki! Auto varam rezervēt pēc Jūsu apstiprinājuma. Lūdzu atbildiet, ja vēlaties turpināt.",
  },
] as const;

function humanDash(raw: string): string {
  return raw.replace(/\u2014/g, "-").replace(/\u2013/g, "-").replace(/\s+/g, " ").trim();
}

function norm(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function irissOrderRoomHitPrice(
  v: Pick<IrissOrderRoomHitSource, "platform" | "priceBuyNow" | "priceCurrent" | "priceStart" | "priceMinimal" | "priceEstimate">,
): number | null {
  return listingComparisonPrice({
    platform: v.platform,
    priceCurrent: v.priceCurrent ?? null,
    priceStart: v.priceStart ?? null,
    priceMinimal: v.priceMinimal ?? null,
    priceBuyNow: v.priceBuyNow ?? null,
    priceEstimate: v.priceEstimate ?? null,
  });
}

function listingYear(hit: Pick<IrissOrderRoomHit, "year" | "firstRegistration">): number | null {
  const reg = hit.firstRegistration.match(/(?:19|20)\d{2}/);
  if (reg) return Number(reg[0]);
  const year = hit.year.match(/(?:19|20)\d{2}/);
  return year ? Number(year[0]) : null;
}

export function parseIrissYearSpan(raw: string): { from: number | null; to: number | null } {
  const years = [...humanDash(raw).matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (years.length === 0) return { from: null, to: null };
  if (years.length === 1) return { from: years[0]!, to: years[0]! };
  return { from: Math.min(...years), to: Math.max(...years) };
}

function parseLooseNumber(raw: string): number | null {
  return parseIrissOrderBudget(raw);
}

function groupInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function buildIrissOrderRoomHits(
  vehicles: readonly IrissOrderRoomHitSource[],
  orderId: string,
  orderOv: Record<string, string[]>,
  extraListingIds?: ReadonlySet<string>,
  /** Pasūtījuma marka/modelis: automātiskās piesaistes ar citu marku vai modeli netiek rādītas. */
  orderBrandModel?: string,
): IrissOrderRoomHit[] {
  const out: IrissOrderRoomHit[] = [];
  for (const v of vehicles) {
    const linked = listingVehicleOrderIds(v.id, v.orderIds, orderOv);
    const extra = extraListingIds?.has(v.id) ?? false;
    if (!linked.includes(orderId) && !extra) continue;
    const manual = orderOv[v.id]?.includes(orderId) ?? false;
    if (!manual && orderBrandModel != null && !listingMatchesOrderMakeModel(v, orderBrandModel)) continue;
    const orderIds = linked.includes(orderId) ? linked : [...linked, orderId];
    const photos = [v.imageUrl ?? "", ...(v.imageUrls ?? [])].map((u) => u.trim()).filter(Boolean);
    const uniquePhotos: string[] = [];
    for (const u of photos) if (!uniquePhotos.includes(u)) uniquePhotos.push(u);
    const row = v as IrissOrderRoomHitSource & Record<string, unknown>;
    out.push({
      id: v.id,
      platform: v.platform,
      externalId: v.externalId,
      detailUrl: (v.detailUrl ?? "").trim(),
      orderIds,
      title: (v.title ?? "").trim(),
      year: (v.year ?? "").trim(),
      firstRegistration: (v.firstRegistration ?? "").trim(),
      mileageKm: typeof v.mileageKm === "number" && v.mileageKm > 0 ? v.mileageKm : null,
      fuel: (v.fuel ?? "").trim(),
      transmission: (v.transmission ?? "").trim(),
      powerKw: (v.powerKw ?? "").trim(),
      color: (v.color ?? "").trim(),
      bodyType: (v.bodyType ?? "").trim(),
      ...(typeof row.doorCount === "string" && row.doorCount.trim() ? { doorCount: row.doorCount.trim() } : {}),
      ...(typeof row.damageRaw === "string" && row.damageRaw.trim() ? { damageRaw: row.damageRaw.trim() } : {}),
      ...(typeof row.sourceCountry === "string" && row.sourceCountry.trim() ? { sourceCountry: row.sourceCountry.trim() } : {}),
      imageUrl: uniquePhotos[0] ?? "",
      imageUrls: uniquePhotos,
      thumbUrl: typeof row.thumbUrl === "string" ? row.thumbUrl.trim() : undefined,
      imageCount: uniquePhotos.length,
      vin: (v.vin ?? "").trim(),
      price: irissOrderRoomHitPrice(v),
      priceStart: typeof row.priceStart === "number" ? row.priceStart : null,
      priceMinimal: typeof row.priceMinimal === "number" ? row.priceMinimal : null,
      priceCurrent: typeof row.priceCurrent === "number" ? row.priceCurrent : null,
      priceBuyNow: typeof row.priceBuyNow === "number" ? row.priceBuyNow : null,
      priceEstimate: typeof row.priceEstimate === "number" ? row.priceEstimate : null,
      priceTotal: typeof row.priceTotal === "number" ? row.priceTotal : null,
      stockNumber: typeof row.stockNumber === "string" ? row.stockNumber.trim() : "",
      auctionId: typeof row.auctionId === "string" ? row.auctionId.trim() : "",
      auctionStage: typeof row.auctionStage === "string" ? row.auctionStage.trim() : "",
      auctionStartAt: typeof row.auctionStartAt === "string" ? row.auctionStartAt.trim() : "",
      auctionEndAt: typeof row.auctionEndAt === "string" ? row.auctionEndAt.trim() : "",
      countryCode: typeof row.countryCode === "string" ? row.countryCode.trim() : "",
      vatNote: typeof row.vatNote === "string" ? row.vatNote.trim() : "",
      salesVatType: typeof row.salesVatType === "number" ? row.salesVatType : null,
      isMargin: typeof row.isMargin === "boolean" ? row.isMargin : null,
      taxDeduction: typeof row.taxDeduction === "boolean" ? row.taxDeduction : null,
      vatRate: typeof row.vatRate === "number" ? row.vatRate : null,
      bidCount: typeof row.bidCount === "number" ? row.bidCount : null,
      change: v.change ?? "unchanged",
      firstSeenAt: (v.firstSeenAt ?? "").trim(),
      lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt.trim() : "",
      location: (v.location ?? "").trim(),
      priceHistory: Array.isArray(row.priceHistory) ? (row.priceHistory as IrissListingPriceChange[]) : v.priceHistory ?? [],
      ...(Array.isArray(v.sourceLinks) && v.sourceLinks.length
        ? {
            sourceLinks: v.sourceLinks
              .map((link) => ({
                platform: link.platform,
                url: typeof link.url === "string" ? link.url.trim() : "",
              }))
              .filter((link) => link.url),
          }
        : {}),
    });
  }
  out.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || a.title.localeCompare(b.title, "lv"));
  return out;
}

export function irissOrderRoomOfferMatchesHit(
  offer: Pick<IrissOfferRecord, "vin" | "brandModel">,
  hit: Pick<IrissOrderRoomHit, "vin" | "title">,
): boolean {
  const vinA = offer.vin.trim().toUpperCase();
  const vinB = hit.vin.trim().toUpperCase();
  if (vinA.length >= 11 && vinA === vinB) return true;
  const a = norm(offer.brandModel);
  const b = norm(hit.title);
  if (a.length >= 8 && b.length >= 8 && (b.includes(a) || a.includes(b))) return true;
  return false;
}

export function irissOrderRoomHitBucket(flags: { dismissed: boolean; saved: boolean; offered: boolean }): IrissOrderRoomHitBucket {
  if (flags.dismissed) return "reject";
  if (flags.offered) return "offered";
  if (flags.saved) return "saved";
  return "new";
}

export function irissOrderRoomVisibleHits(
  hits: readonly IrissOrderRoomHit[],
  dismissed: ReadonlySet<string>,
  offered: ReadonlySet<string>,
): IrissOrderRoomHit[] {
  return hits.filter((h) => h.change !== "gone" || dismissed.has(h.id) || offered.has(h.id));
}

function driveHit(orderDrive: string, hay: string): boolean | null {
  const raw = orderDrive.trim();
  if (!raw || !hay.trim()) return null;
  const listing = normalizeDrive(hay);
  if (!acceptedNormalization(listing.confidence, listing.group)) return null;
  return drivesMatchGroups(hay, [raw]);
}

/** Pasūtījuma lauki, pēc kuriem auto salīdzina ar prasībām (pasūtījuma telpa un Sludinājumu kartīte). */
export type IrissOrderRoomMatchCriteria = Pick<
  IrissPasutijumsRecord,
  | "totalBudget"
  | "productionYears"
  | "maxMileage"
  | "transmission"
  | "bodyType"
  | "driveType"
  | "preferredColors"
  | "nonPreferredColors"
  | "engineType"
  | "modelExtension"
>;

export function irissOrderRoomCriteriaChecks(rec: IrissOrderRoomMatchCriteria, hit: IrissOrderRoomHit): IrissOrderRoomCheck[] {
  const checks: IrissOrderRoomCheck[] = [];
  const budget = parseLooseNumber(rec.totalBudget);
  if (budget != null) {
    if (hit.price == null) checks.push({ id: "budget", label: "nav cenas", pass: false });
    else checks.push({ id: "budget", label: "budžets", pass: hit.price <= budget });
  }
  const span = parseIrissYearSpan(rec.productionYears);
  const year = listingYear(hit);
  if (span.from != null || span.to != null) {
    const pass =
      year != null && (span.from == null || year >= span.from) && (span.to == null || year <= span.to);
    checks.push({ id: "year", label: "gadi", pass });
  }
  const maxKm = parseLooseNumber(rec.maxMileage);
  if (maxKm != null && hit.mileageKm != null) {
    checks.push({ id: "km", label: "km", pass: hit.mileageKm <= maxKm });
  }
  if (rec.transmission.trim() && hit.transmission.trim()) {
    checks.push({
      id: "gear",
      label: humanDash(rec.transmission),
      pass: gearboxesMatchGroups(hit.transmission, [rec.transmission], hit.platform),
    });
  }
  if (rec.bodyType.trim() && (hit.bodyType.trim() || hit.title.trim())) {
    checks.push({
      id: "body",
      label: humanDash(rec.bodyType),
      pass: bodiesMatchGroups(`${hit.bodyType} ${hit.title}`, [rec.bodyType], hit.platform),
    });
  }
  const drive = driveHit(rec.driveType, `${hit.title} ${hit.bodyType}`);
  if (drive != null) checks.push({ id: "drive", label: humanDash(rec.driveType), pass: drive });
  const colorHay = hit.color.trim();
  const wanted = irissOrderRoomExcludeTokens(rec.preferredColors);
  const banned = irissOrderRoomExcludeTokens(rec.nonPreferredColors);
  if (colorHay && (wanted.length > 0 || banned.length > 0)) {
    checks.push({ id: "color", label: "krāsa", pass: colorsMatchGroups(colorHay, wanted, banned) });
  }
  const engine = rec.engineType.trim();
  if (engine && hit.fuel.trim()) {
    checks.push({
      id: "engine",
      label: "dzinējs",
      pass: fuelsMatchGroups(hit.fuel, [engine], hit.platform),
    });
  }

  return checks;
}

export function irissOrderRoomMatch(rec: IrissOrderRoomMatchCriteria, hit: IrissOrderRoomHit): IrissOrderRoomMatch {
  const checks = irissOrderRoomCriteriaChecks(rec, hit);
  const equipmentBadges: IrissOrderRoomCheck[] = [];
  const trimHay = `${hit.title} ${hit.bodyType}`;
  if (rec.modelExtension.trim() && titleHasAnyModelExtension(trimHay, splitModelExtensions(rec.modelExtension))) {
    equipmentBadges.push({ id: "trim", label: humanDash(rec.modelExtension), pass: true });
  }

  const percent = checks.length > 0 ? Math.round((checks.filter((c) => c.pass).length / checks.length) * 100) : null;
  const identity = new Set(["drive", "color", "gear", "body"]);
  const badges = [
    ...checks.filter((c) => !c.pass),
    ...equipmentBadges,
    ...checks.filter((c) => c.pass && identity.has(c.id)),
    ...checks.filter((c) => c.pass && !identity.has(c.id)),
  ].slice(0, 4);
  return { percent, badges };
}

export function irissOrderRoomHitPassesCriteria(rec: IrissPasutijumsRecord, hit: IrissOrderRoomHit): boolean {
  const span = parseIrissYearSpan(rec.productionYears);
  const year = listingYear(hit);
  if (span.from != null || span.to != null) {
    if (year == null) return false;
    if (span.from != null && year < span.from) return false;
    if (span.to != null && year > span.to) return false;
  }
  const budget = parseLooseNumber(rec.totalBudget);
  if (budget != null) {
    if (hit.price == null) return false;
    if (hit.price > budget) return false;
  }
  const maxKm = parseLooseNumber(rec.maxMileage);
  if (maxKm != null && hit.mileageKm != null && hit.mileageKm > maxKm) return false;
  const banned = irissOrderRoomExcludeTokens(rec.nonPreferredColors);
  if (hit.color.trim() && !colorsMatchGroups(hit.color, [], banned)) return false;
  if (rec.modelExtension.trim() && !titleHasAnyModelExtension(`${hit.title} ${hit.bodyType}`, splitModelExtensions(rec.modelExtension))) {
    return false;
  }
  return true;
}

export function irissOrderRoomCriteriaChips(rec: IrissPasutijumsRecord): IrissOrderRoomChip[] {
  const chips: IrissOrderRoomChip[] = [];
  const budget = parseLooseNumber(rec.totalBudget);
  if (budget != null) chips.push({ id: "budget", label: `≤ ${listingFmtEur(budget)}`, tone: "neutral" });
  else if (rec.totalBudget.trim()) chips.push({ id: "budget", label: humanDash(rec.totalBudget), tone: "neutral" });
  if (rec.productionYears.trim()) chips.push({ id: "years", label: humanDash(rec.productionYears), tone: "neutral" });
  if (rec.engineType.trim()) chips.push({ id: "engine", label: humanDash(rec.engineType), tone: "neutral" });
  if (rec.transmission.trim()) chips.push({ id: "gear", label: humanDash(rec.transmission), tone: "neutral" });
  if (rec.bodyType.trim()) chips.push({ id: "body", label: humanDash(rec.bodyType), tone: "neutral" });
  if (rec.driveType.trim()) chips.push({ id: "drive", label: humanDash(rec.driveType), tone: "neutral" });
  const km = parseLooseNumber(rec.maxMileage);
  if (km != null) chips.push({ id: "km", label: `≤ ${groupInt(km)} km`, tone: "neutral" });
  if (rec.preferredColors.trim()) chips.push({ id: "color", label: humanDash(rec.preferredColors), tone: "neutral" });
  if (rec.modelExtension.trim()) chips.push({ id: "trim", label: humanDash(rec.modelExtension), tone: "neutral" });
  return chips;
}

export function irissOrderRoomExcludeTokens(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]+/)) {
    const t = humanDash(part);
    if (!t) continue;
    const key = t.toLocaleLowerCase("lv");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function irissOrderRoomOfferSeed(hit: IrissOrderRoomHit): IrissOrderRoomOfferSeed {
  const year = hit.year || (hit.firstRegistration.match(/(?:19|20)\d{2}/)?.[0] ?? "");
  const price = hit.price != null ? String(Math.round(hit.price)) : "";
  return {
    brandModel: hit.title,
    vin: irissListingVin(hit.vin),
    year,
    mileage: hit.mileageKm != null ? String(Math.round(hit.mileageKm)) : "",
    price,
    transmission: hit.transmission,
    firstRegistration: hit.firstRegistration || year,
    photoUrls: auctionPhotoUrlsFromHit(hit),
  };
}

function parseMoney(raw: string): number {
  const compact = raw.replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? n : 0;
}

export function irissOrderRoomOfferTotal(
  offer: Pick<IrissOfferRecord, "carPrice" | "deliveryPrice" | "commissionFee" | "priceGermany">,
): number | null {
  const sum = parseMoney(offer.carPrice) + parseMoney(offer.deliveryPrice) + parseMoney(offer.commissionFee);
  if (sum > 0) return Math.round(sum);
  const legacy = parseMoney(offer.priceGermany);
  return legacy > 0 ? Math.round(legacy) : null;
}

export function irissOrderRoomOfferStatus(offer: Pick<IrissOfferRecord, "brandModel" | "carPrice" | "priceGermany">): "draft" | "ready" {
  if (offer.brandModel.trim() || offer.carPrice.trim() || offer.priceGermany.trim()) return "ready";
  return "draft";
}

/** Privātā Vercel Blob saite pārlūkā neielādējas (vajag tokenu) - tikai caur admin starpnieku. */
const PRIVATE_BLOB_URL_RE = /^https:\/\/[^/]+\.private\.blob\.vercel-storage\.com\//i;

export function irissOrderRoomOfferThumb(
  offer: Pick<IrissOfferRecord, "id" | "attachments" | "coverAttachmentId">,
  orderId?: string,
): string {
  for (const a of orderOfferAttachmentsForPdf(offer)) {
    const src = offerImageGridSrc(a);
    if (!src) continue;
    if (PRIVATE_BLOB_URL_RE.test(src)) {
      // Pirms ?images=thumbs ielādes (un uzreiz pēc piedāvājuma saglabāšanas) bija salauzta bilde.
      if (!orderId) continue;
      return `/api/admin/iriss-pasutijumi/${encodeURIComponent(orderId)}/offer/${encodeURIComponent(offer.id)}/photo/${encodeURIComponent(a.id)}`;
    }
    return src;
  }
  return "";
}

export function irissOrderRoomHitShareText(hit: IrissOrderRoomHit): string {
  const bits = [
    hit.title,
    hit.year,
    hit.mileageKm != null ? `${groupInt(hit.mileageKm)} km` : "",
    hit.price != null ? listingFmtEur(hit.price) : "",
  ].filter(Boolean);
  const lines = [`Sveiki! Apskatīju šo auto: ${bits.join(", ")}.`];
  if (hit.detailUrl) lines.push(hit.detailUrl);
  lines.push("", "Labu dienu,", "PROVIN.LV");
  return lines.join("\n");
}

export function irissOrderRoomRef(id: string): string {
  const tail = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return tail ? `P-${tail}` : "Pasūtījums";
}

export function irissOrderRoomStamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  if (!day || !month) return "";
  return `${day}.${month} ${hour}:${minute}`;
}

export function irissOrderRoomSavedLabel(iso: string): string {
  const stamp = irissOrderRoomStamp(iso);
  const time = stamp.split(" ")[1] ?? "";
  return time ? `saglabāts ${time}` : "";
}

export function irissOrderRoomShortDate(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}`;
}

export function irissOrderRoomDealPill(rec: IrissPasutijumsRecord): string | null {
  const labels = IRISS_DEAL_DETAIL_OPTIONS.filter((opt) => Boolean(rec[opt.key])).map((opt) => opt.label);
  if (labels.length === 0) return null;
  const head = labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0]!;
  const date = irissOrderRoomShortDate(rec.orderDate);
  return [head, date].filter(Boolean).join(" · ");
}

export function irissOrderRoomClientLine(rec: IrissPasutijumsRecord): string {
  const name = [rec.clientFirstName, rec.clientLastName].map((s) => s.trim()).filter(Boolean).join(" ");
  const parts = [name, rec.phone.trim(), rec.email.trim()];
  if (rec.totalBudget.trim()) parts.push(`budžets ${humanDash(rec.totalBudget)}`);
  const saved = irissOrderRoomSavedLabel(rec.updatedAt);
  if (saved) parts.push(saved);
  return parts.filter(Boolean).join(" · ");
}

export function irissOrderRoomNextSteps(input: {
  newHits: number;
  offerCount: number;
  hasPhone: boolean;
  hasVin?: boolean;
  /** Pasūtījuma saraksta statuss: pēc apstiprināta piedāvājuma («Rezervēts») piedāvājums vairs nav jāgatavo. */
  listStatus?: string;
}): IrissOrderRoomNextStep[] {
  const steps: IrissOrderRoomNextStep[] = [];
  if (input.listStatus === "reserved") {
    // Audits 27.10: pēc klienta apstiprinājuma rādīja «Sagatavot pirmo piedāvājumu».
    steps.push({ id: "deposit", label: "Saņemt avansu", tab: "overview" });
    if (input.hasPhone) steps.push({ id: "contact", label: "Sazināties ar klientu", tab: "communication" });
    return steps;
  }
  if (input.listStatus === "completed" || input.listStatus === "inactive") return steps;
  if (input.newHits > 0) {
    steps.push({
      id: "hits",
      label: `Apskatīt ${input.newHits} ${input.newHits === 1 ? "jaunu sludinājumu" : "jaunus sludinājumus"}`,
      tab: "search",
    });
  }
  if (input.offerCount === 0) {
    steps.push({ id: "offer", label: "Sagatavot pirmo piedāvājumu", tab: "offers" });
  }
  void input.hasVin;
  if (input.hasPhone) steps.push({ id: "contact", label: "Sazināties ar klientu", tab: "communication" });
  return steps;
}

export function irissOrderRoomListingLinkCount(rec: IrissPasutijumsRecord): number {
  return (
    filledIrissListingLinks(rec.listingLinkMobile).length +
    filledIrissListingLinks(rec.listingLinkAutobid).length +
    filledIrissListingLinks(rec.listingLinkOpenline).length +
    filledIrissListingLinks(rec.listingLinkAuto1).length +
    filledIrissListingLinks(rec.listingLinkEcarstrade).length +
    filledIrissListingLinks(rec.listingLinksOther).length
  );
}

export function irissOrderRoomPlatformLabels(hits: readonly IrissOrderRoomHit[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.platform)) continue;
    seen.add(h.platform);
    out.push(IRISS_LISTING_PLATFORM_LABEL[h.platform] ?? h.platform);
  }
  return out;
}

export function irissOrderRoomCommunicationCount(historyLength: number, hasNotes: boolean): number {
  return historyLength + (hasNotes ? 1 : 0);
}

export function irissOrderRoomDocumentCount(offerCount: number, generatedCount = 0): number {
  return 2 + Math.max(0, offerCount) + Math.max(0, generatedCount);
}

export function appendIrissOrderRoomNote(prev: string, text: string, atIso: string): string {
  const line = text.replace(/\u2014/g, "-").replace(/\u2013/g, "-").trim();
  if (!line) return prev;
  const stamp = irissOrderRoomStamp(atIso);
  const block = stamp ? `${stamp} ${line}` : line;
  const base = prev.trim();
  return base ? `${base}\n${block}` : block;
}

export function irissOrderRoomStatusLabel(status: IrissPasutijumsRecord["listStatus"]): string {
  return displayIrissPasutijumsListStatusLabel(status);
}
