/**
 * IRISS pasūtījuma istaba: jau nolasīto Meklētāja trāpījumu kārtošana, kritēriji, piedāvājumi.
 * Šis modulis neko neielādē no maksas avotiem un neizsauc sync.
 */

import { offerImageGridSrc, orderOfferAttachmentsForPdf } from "@/lib/iriss-offer-image-sorter";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { listingFmtEur } from "@/lib/iriss-listings-card";
import { listingComparisonPrice } from "@/lib/iriss-listings-cost";
import { listingVehicleOrderIds } from "@/lib/iriss-listings-orders";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform, IrissListingVehicleChange } from "@/lib/iriss-listings-types";
import { irissListingVin } from "@/lib/iriss-pasutijums-from-listing";
import {
  IRISS_DEAL_DETAIL_OPTIONS,
  IRISS_PASUTIJUMS_LIST_STATUS_LV,
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
  imageUrl: string;
  imageCount: number;
  vin: string;
  price: number | null;
  change: IrissListingVehicleChange;
  firstSeenAt: string;
  location: string;
};

export type IrissOrderRoomHitSource = {
  id: string;
  platform: IrissListingPlatform;
  externalId: string;
  detailUrl: string;
  orderIds: readonly string[];
  title: string;
  year?: string;
  firstRegistration?: string;
  mileageKm?: number | null;
  fuel?: string;
  transmission?: string;
  powerKw?: string;
  color?: string;
  bodyType?: string;
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

function includesText(hay: string, needle: string): boolean {
  const h = norm(hay);
  const n = norm(needle);
  if (!h || !n || n.length < 2) return false;
  if (n.length <= 3) return h.split(" ").some((word) => word === n);
  return h.includes(n) || n.includes(h);
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
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function groupInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function buildIrissOrderRoomHits(
  vehicles: readonly IrissOrderRoomHitSource[],
  orderId: string,
  orderOv: Record<string, string[]>,
  extraListingIds?: ReadonlySet<string>,
): IrissOrderRoomHit[] {
  const out: IrissOrderRoomHit[] = [];
  for (const v of vehicles) {
    const linked = listingVehicleOrderIds(v.id, v.orderIds, orderOv);
    const extra = extraListingIds?.has(v.id) ?? false;
    if (!linked.includes(orderId) && !extra) continue;
    const orderIds = linked.includes(orderId) ? linked : [...linked, orderId];
    const photos = [v.imageUrl ?? "", ...(v.imageUrls ?? [])].map((u) => u.trim()).filter(Boolean);
    const uniquePhotos: string[] = [];
    for (const u of photos) if (!uniquePhotos.includes(u)) uniquePhotos.push(u);
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
      imageUrl: uniquePhotos[0] ?? "",
      imageCount: uniquePhotos.length,
      vin: (v.vin ?? "").trim(),
      price: irissOrderRoomHitPrice(v),
      change: v.change ?? "unchanged",
      firstSeenAt: (v.firstSeenAt ?? "").trim(),
      location: (v.location ?? "").trim(),
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

const DRIVE_GROUPS: ReadonlyArray<{ needles: string[]; label: string }> = [
  { needles: ["quattro", "4x4", "awd", "4motion", "xdrive", "4matic", "pilnpiedzina"], label: "4x4" },
  { needles: ["fwd", "prieksej"], label: "priekšējā" },
  { needles: ["rwd", "aizmugur"], label: "aizmugurējā" },
];

function driveHit(orderDrive: string, hay: string): boolean | null {
  const raw = orderDrive.trim();
  if (!raw || !hay.trim()) return null;
  if (includesText(hay, raw)) return true;
  const nOrder = norm(raw);
  const nHay = norm(hay);
  const group = DRIVE_GROUPS.find((g) => g.needles.some((n) => nOrder.includes(n)) || includesText(raw, g.label));
  if (!group) return null;
  const hayHasDrive = DRIVE_GROUPS.some((g) => g.needles.some((n) => nHay.includes(n)));
  if (!hayHasDrive) return null;
  return group.needles.some((n) => nHay.includes(n));
}

export function irissOrderRoomMatch(rec: IrissPasutijumsRecord, hit: IrissOrderRoomHit): IrissOrderRoomMatch {
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
    checks.push({ id: "gear", label: humanDash(rec.transmission), pass: includesText(hit.transmission, rec.transmission) });
  }
  if (rec.bodyType.trim() && (hit.bodyType.trim() || hit.title.trim())) {
    checks.push({
      id: "body",
      label: humanDash(rec.bodyType),
      pass: includesText(`${hit.bodyType} ${hit.title}`, rec.bodyType),
    });
  }
  const drive = driveHit(rec.driveType, `${hit.title} ${hit.bodyType}`);
  if (drive != null) checks.push({ id: "drive", label: humanDash(rec.driveType), pass: drive });
  const colorHay = hit.color.trim();
  const wanted = irissOrderRoomExcludeTokens(rec.preferredColors);
  const banned = irissOrderRoomExcludeTokens(rec.nonPreferredColors);
  if (colorHay && (wanted.length > 0 || banned.length > 0)) {
    const excluded = banned.some((c) => includesText(colorHay, c));
    const wantedOk = wanted.length === 0 || wanted.some((c) => includesText(colorHay, c));
    checks.push({ id: "color", label: "krāsa", pass: !excluded && wantedOk });
  }
  const engine = rec.engineType.trim();
  if (engine) {
    const hay = `${hit.fuel} ${hit.powerKw} ${hit.title}`;
    const power = parseLooseNumber(hit.powerKw);
    const wantedPower = [...engine.matchAll(/\d{2,3}/g)].map((m) => Number(m[0])).find((n) => n >= 40 && n <= 800);
    const tokens = norm(engine)
      .split(" ")
      .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && t !== "tips");
    const tokenOk = tokens.some((t) => norm(hay).includes(t));
    const powerOk = wantedPower != null && power != null && Math.abs(power - wantedPower) <= 5;
    if (hay.trim() && (tokens.length > 0 || (wantedPower != null && power != null))) {
      checks.push({ id: "engine", label: "dzinējs", pass: tokenOk || powerOk });
    }
  }

  const equipmentBadges: IrissOrderRoomCheck[] = [];
  const equipHay = `${hit.title} ${hit.fuel} ${hit.bodyType}`;
  for (const token of irissOrderRoomExcludeTokens(rec.equipmentRequired)) {
    if (token.length < 3) continue;
    if (includesText(equipHay, token)) equipmentBadges.push({ id: `eq-${norm(token)}`, label: humanDash(token), pass: true });
    if (equipmentBadges.length >= 2) break;
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
  if (hit.color.trim() && banned.some((c) => includesText(hit.color, c))) return false;
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
  if (rec.equipmentRequired.trim()) {
    chips.push({ id: "required", label: `Obligāti: ${humanDash(rec.equipmentRequired)}`, tone: "required" });
  }
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

export function irissOrderRoomOfferThumb(
  offer: Pick<IrissOfferRecord, "attachments" | "coverAttachmentId">,
): string {
  for (const a of orderOfferAttachmentsForPdf(offer)) {
    const src = offerImageGridSrc(a);
    if (src) return src;
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
  hasVin: boolean;
}): IrissOrderRoomNextStep[] {
  const steps: IrissOrderRoomNextStep[] = [];
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
  if (!input.hasVin) steps.push({ id: "vin", label: "Ievadīt VIN, ja tas ir zināms", tab: "overview" });
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

export function irissOrderRoomDocumentCount(offerCount: number): number {
  return 2 + Math.max(0, offerCount);
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
  return IRISS_PASUTIJUMS_LIST_STATUS_LV[status];
}
