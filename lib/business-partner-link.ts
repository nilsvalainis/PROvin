import { embedHostFromUrl, isEmbedHostAllowed, type B2bPartnerEmbedSettings } from "@/lib/b2b-partner-embed";
import { parseBusinessLinkCar, type BusinessLinkCar, type BusinessLinkRecord } from "@/lib/business-link";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

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
  if (!isValidVin(params.vin)) return { ok: false, reason: "vin" };
  return { ok: true };
}

/** VIN jābūt sludinājuma lapas HTML (redzams tekstā vai pogas `data-vin`). */
export function listingHtmlHasVin(html: string, vin: string): boolean {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return false;
  return html.toUpperCase().includes(v);
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
    prefillVin: normalizeVin(opts.params.vin),
    partnerId: opts.partnerId,
    listingUrl: opts.params.listingUrl,
    car: opts.params.car,
    listingVerified: opts.listingVerified,
  };
}
