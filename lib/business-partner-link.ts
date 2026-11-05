import { embedHostFromUrl, isEmbedHostAllowed, type B2bPartnerEmbedSettings } from "@/lib/b2b-partner-embed";
import { parseBusinessLinkCar, type BusinessLinkCar, type BusinessLinkRecord } from "@/lib/business-link";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/**
 * Partnera pastāvīgā saite `/b/p/{partnerId}?vin=...&url=...`.
 * Katrs derīgs klikšķis izveido jaunu vienreizēju `/b/{token}` saiti (1 h), piesaistītu VIN.
 * Saite NEKAD neatveras bez: partnera ar ieslēgtu pogu, Referer no partnera domēna,
 * sludinājuma saites partnera domēnā un VIN, kas atrodams sludinājuma lapā.
 */

export const PARTNER_LINK_PATH_PREFIX = "/b/p";
export const PARTNER_LINK_VALIDITY_MS = 60 * 60 * 1000;
export const BUSINESS_LINK_CLOSED_PATH = "/b/slegta";

export type PartnerClickParams = {
  vin: string;
  /** LV numurzīme, ja dīleris VIN nenorāda (VIN nosaka caur CSDD). */
  plate: string;
  listingUrl: string;
  car: BusinessLinkCar;
};

export type PartnerClickDenyReason =
  | "partner"
  | "disabled"
  | "referer"
  | "listing"
  | "vin";

export function parsePartnerClickParams(sp: URLSearchParams): PartnerClickParams {
  return {
    vin: normalizeVin(sp.get("vin") ?? ""),
    plate: normalizePlateNumber(sp.get("plate") ?? ""),
    listingUrl: (sp.get("url") ?? "").trim().slice(0, 500),
    car: parseBusinessLinkCar({
      title: sp.get("title"),
      imageUrl: sp.get("img"),
      year: sp.get("year"),
      mileageKm: sp.get("km"),
      fuel: sp.get("fuel"),
      gearbox: sp.get("gear"),
    }),
  };
}

/** Pārbaudes, ko var izdarīt bez tīkla. Sludinājuma lapas saturu pārbauda `listingHtmlHasVin`. */
export function checkPartnerClick(opts: {
  partner: { status: "active" | "disabled"; businessEmbed: B2bPartnerEmbedSettings } | null;
  referer: string | null;
  params: PartnerClickParams;
}): { ok: true } | { ok: false; reason: PartnerClickDenyReason } {
  const { partner, params } = opts;
  if (!partner || partner.status !== "active") return { ok: false, reason: "partner" };
  const embed = partner.businessEmbed;
  if (!embed.enabled || embed.domains.length === 0) return { ok: false, reason: "disabled" };
  if (!isEmbedHostAllowed(embedHostFromUrl(opts.referer), embed.domains)) return { ok: false, reason: "referer" };
  if (!isEmbedHostAllowed(embedHostFromUrl(params.listingUrl), embed.domains)) return { ok: false, reason: "listing" };
  if (!isHttpsListingUrl(params.listingUrl)) return { ok: false, reason: "listing" };
  if (!isValidVin(params.vin) && !isValidPlateNumber(params.plate)) return { ok: false, reason: "vin" };
  /** VIN vai numurzīme sludinājuma adresē (piem. meklēšana `?s=VIN`) - lapa to atkārtotu. */
  if (listingUrlMentionsVehicle(params.listingUrl, params)) return { ok: false, reason: "listing" };
  if (!refererMatchesListing(opts.referer, params.listingUrl)) return { ok: false, reason: "referer" };
  return { ok: true };
}

/** Tikai https un standarta ports. */
export function isHttpsListingUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.port === "" || u.port === "443") && !u.username && !u.password;
  } catch {
    return false;
  }
}

function urlPathKey(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`;
  } catch {
    return "";
  }
}

/**
 * Pogas skripts sūta pilnu Referer. Ja Referer satur ceļu, tam jāsakrīt ar sludinājuma adresi.
 * Ja pārlūks sūta tikai origin (stingra politika), pietiek ar domēnu.
 */
export function refererMatchesListing(referer: string | null, listingUrl: string): boolean {
  if (!referer) return false;
  const refKey = urlPathKey(referer);
  if (!refKey || refKey === "/") return true;
  return refKey === urlPathKey(listingUrl);
}

/**
 * VIN vai numurzīme sludinājuma adreses vaicājumā (`?s=VIN`) - meklēšanas lapa to atkārtotu HTML.
 * Ceļā (`/auto-katalogs/audi-q5-wauzzz...`) VIN der: tā partneri veido sludinājumu adreses.
 */
export function listingUrlMentionsVehicle(listingUrl: string, params: Pick<PartnerClickParams, "vin" | "plate">): boolean {
  let query = "";
  try {
    query = new URL(listingUrl).search;
  } catch {
    return true;
  }
  try {
    query = decodeURIComponent(query);
  } catch {
    /* paliek kā ir */
  }
  const up = query.toUpperCase();
  if (params.vin && up.includes(normalizeVin(params.vin))) return true;
  const plate = normalizePlateNumber(params.plate);
  return Boolean(plate) && up.replace(/[\s-]/g, "").includes(plate);
}

/** HTML bez skriptiem, stiliem un tagiem: tikai redzamais teksts un atribūtu vērtības nav iekšā. */
export function listingVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ");
}

/** VIN jābūt sludinājuma lapas HTML (redzams tekstā vai pogas `data-vin`). */
export function listingHtmlHasVin(html: string, vin: string): boolean {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return false;
  return html.toUpperCase().includes(v);
}

/** Numurzīme sludinājuma redzamajā tekstā kā atsevišķs vārds (starp burtiem un cipariem drīkst būt atstarpe vai defise). */
export function listingHtmlHasPlate(html: string, plate: string): boolean {
  const p = normalizePlateNumber(plate);
  if (!isValidPlateNumber(p)) return false;
  const m = /^([A-Z]+)(\d+)$/.exec(p);
  if (!m) return false;
  const re = new RegExp(`(^|[^A-Z0-9])${m[1]}[\\s\\u00a0-]?${m[2]}([^A-Z0-9]|$)`);
  return re.test(listingVisibleText(html).toUpperCase());
}

/** Identifikators, kas jāatrod sludinājumā: VIN, ja dots, citādi numurzīme. */
export function listingHtmlHasVehicleId(html: string, params: Pick<PartnerClickParams, "vin" | "plate">): boolean {
  return isValidVin(params.vin) ? listingHtmlHasVin(html, params.vin) : listingHtmlHasPlate(html, params.plate);
}

export function newPartnerBusinessLinkRecord(opts: {
  tokenHash: string;
  partnerId: string;
  params: PartnerClickParams;
  listingVerified: boolean;
  nowMs?: number;
}): BusinessLinkRecord {
  const now = opts.nowMs ?? Date.now();
  return {
    tokenHash: opts.tokenHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PARTNER_LINK_VALIDITY_MS).toISOString(),
    status: "open",
    recipientChannel: "email",
    recipient: "",
    prefillVin: isValidVin(opts.params.vin) ? normalizeVin(opts.params.vin) : normalizePlateNumber(opts.params.plate),
    partnerId: opts.partnerId,
    listingUrl: opts.params.listingUrl,
    car: opts.params.car,
    listingVerified: opts.listingVerified,
  };
}
