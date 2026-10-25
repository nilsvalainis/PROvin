/**
 * j56: detaļu lapu konfigurācija pa platformām (Auto1, Openlane). Autobid nav (nav lauku kartes).
 * Tikai tīra loģika: hosti, auto id no saites, ciļņu nosaukumi, kuri JSON nav auto dati.
 */
import { auto1ApiTemplate, mapAuto1Car } from "./platforms/auto1.mjs";
import { openlaneEnglishUrl } from "./platforms/openlane-logic.mjs";

function auto1Key(url) {
  try {
    const m = new URL(url).pathname.match(/\/car\/([A-Za-z]{1,3}\d{4,})(?:\/|$)/);
    return m ? m[1].toUpperCase() : "";
  } catch {
    return "";
  }
}

function openlaneKey(url) {
  try {
    const u = new URL(url);
    const q = (u.searchParams.get("auctionId") ?? u.searchParams.get("auctionid") ?? "").trim();
    if (/^\d{4,}$/.test(q)) return q;
    const m = u.pathname.match(/\/car\/(\d{4,})(?:\/|$)/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

export const DETAIL_PLATFORMS = {
  auto1: {
    label: "Auto1",
    hostRe: /(^|\.)auto1\.(com|eu)$/,
    detailKey: auto1Key,
    apiHostRe: /auto1(?:\.com|\.cloud|\.eu|-group\.com)/i,
    apiTemplate: auto1ApiTemplate,
    /** Konta, finanšu un saraksta API: nav šī auto dati. */
    skipApiRe: /user-token|merchant-viban|merchant-financing|my-orders-view|banner-mgmt|in-page-alerts|currency-rate|voucher|saved-search|car-search\/(?:cars\/(?:search|recommended)|filters|batches)|manifest\.json/i,
    loggedOutUrlRe: /\/merchant\/signin|\/login\b|\/signin\b/i,
    photoHostRe: /auto1\.(?:com|cloud|eu)|img-pa\./i,
    tabTexts: [/^\s*(?:Condition|Damages?)\s*$/i, /^\s*(?:Car )?Equipment\s*$/i, /^\s*Service\s*$/i, /^\s*Documents\s*$/i],
    mapItem: (obj) => (obj && (obj.stockNumber || obj.manufacturerName) ? mapAuto1Car(obj) : null),
  },
  openlane: {
    label: "Openlane",
    hostRe: /(^|\.)openlane\.(eu|com)$/,
    normalizeUrl: openlaneEnglishUrl,
    detailKey: openlaneKey,
    apiHostRe: /openlane\.(?:eu|com)/i,
    skipApiRe: /CurrentUserDetails|myaccount|findcarv6\/search|notification|basket|favourite|watchlist|translations?|resources/i,
    loggedOutUrlRe: /id\.openlane\.eu|\/login\b|\/signin\b/i,
    photoHostRe: null,
    tabTexts: [/^\s*Equipment\s*$/i, /^\s*Condition\s*$/i, /^\s*(?:Documents|Delivery)\s*$/i],
    mapItem: null,
  },
};

export const DETAIL_PLATFORM_IDS = Object.keys(DETAIL_PLATFORMS);
