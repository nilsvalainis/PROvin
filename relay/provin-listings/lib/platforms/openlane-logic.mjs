/**
 * Openlane tīrā loģika bez Playwright (login pazīmes, /en/ ceļš, PVN kartītes, saraksta mapping).
 */
import { isoDate, makeItem, num, price, str, yearOf } from "../items.mjs";

export const PROBE_URL = process.env.OPENLANE_PROBE_URL || "https://www.openlane.eu/en/findcar";
export const SEARCH_API_RE = /\/findcarv6\/search/i;
export const CURRENT_USER_PATH = "/en/myaccount/homev6/CurrentUserDetails";
export const LOGGED_IN_RE = new RegExp(process.env.OPENLANE_LOGGED_IN_TEXT || "(log ?out|sign out|my account|my openlane|mijn account|abmelden)", "i");
export const LOGGED_OUT_HOST_RE = /id\.openlane\.eu|\/login\b|\/signin\b/i;
const DETAIL_TEMPLATE = process.env.OPENLANE_DETAIL_URL_TEMPLATE || "https://www.openlane.eu/en/car/{auctionId}";
const VAT_LABEL_KEYS = ["VatText", "VatLabel", "VatDescription", "VatType", "VatRegime", "VatInfo", "TaxType", "VatDisplay", "DisplayVat", "Vat", "VAT"];
const CURRENT_USER_NAME_KEYS = ["UserName", "Username", "userName", "Name", "FullName", "Email", "email", "FirstName", "LastName", "DisplayName", "NickName", "LoginName"];

/** /ru/findcar -> /en/findcar (query saglabājas). */
export function openlaneEnglishUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)openlane\.eu$/i.test(u.hostname)) return url;
    u.pathname = u.pathname.replace(/^\/[a-z]{2}(?=\/|$)/i, "/en");
    return u.toString();
  } catch {
    return url;
  }
}

export function openlaneCurrentUserShowsLogin(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const rec = json;
  if (rec.IsAuthenticated === false || rec.isAuthenticated === false || rec.Authenticated === false) return false;
  if (rec.IsAuthenticated === true || rec.isAuthenticated === true || rec.Authenticated === true) return true;
  const nested = rec.Data || rec.data || rec.User || rec.user || rec.Result || rec.result;
  const objs = [rec];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) objs.push(nested);
  for (const o of objs) {
    for (const k of CURRENT_USER_NAME_KEYS) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return true;
    }
  }
  return false;
}

/**
 * ChassisNumber netiek ņemts vērā. Login poga #loginButton2 vai CurrentUserDetails.
 * @param {{ url?: string, loginButtonPresent?: boolean|null, currentUserJson?: unknown, pageText?: string }} facts
 */
export function openlaneSessionLooksLoggedIn(facts) {
  const url = String(facts?.url || "");
  if (!url || LOGGED_OUT_HOST_RE.test(url)) return false;
  if (openlaneCurrentUserShowsLogin(facts?.currentUserJson)) return true;
  if (facts?.loginButtonPresent === true) return false;
  if (facts?.loginButtonPresent === false && /openlane\.eu/i.test(url)) return true;
  return LOGGED_IN_RE.test(String(facts?.pageText || ""));
}

export function coerceOpenlaneMargin(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.trim();
    if (/^(true|yes|1)$/i.test(s)) return true;
    if (/^(false|no|0)$/i.test(s)) return false;
  }
  return null;
}

export function pickOpenlaneVatNote(auction) {
  if (!auction || typeof auction !== "object") return "";
  for (const k of VAT_LABEL_KEYS) {
    const s = str(auction[k]);
    if (s && !/^\d+$/.test(s)) return s;
  }
  for (const [k, v] of Object.entries(auction)) {
    if (VAT_LABEL_KEYS.includes(k) || typeof v === "boolean" || typeof v === "number") continue;
    if (!/vat|mwst|nds|tax|margin|ндс|марж/i.test(k)) continue;
    const s = str(v);
    if (s && s.length < 80 && !/^\d+$/.test(s)) return s;
  }
  if (coerceOpenlaneMargin(auction.IsMargin ?? auction.isMargin) === true) return "Margin";
  return "";
}

function detailUrlFor(auction, anchors) {
  const auctionId = str(auction.AuctionId);
  const carId = str(auction.CarId);
  const hit = anchors.find((h) => (auctionId && new RegExp(`[/=-]${auctionId}(?:[/?#]|$)`).test(h)) || (carId && new RegExp(`[/=-]${carId}(?:[/?#]|$)`).test(h)));
  if (hit) return hit;
  return DETAIL_TEMPLATE.replace("{auctionId}", encodeURIComponent(auctionId)).replace("{carId}", encodeURIComponent(carId));
}

function stageFor(auction, nowMs) {
  const start = Date.parse(isoDate(auction.BatchStartDate));
  const end = Date.parse(isoDate(auction.BatchEndDate));
  if (Number.isFinite(start) && nowMs < start) return "BEFORE_AUCTION";
  if (Number.isFinite(end) && nowMs > end) return "AFTER_AUCTION";
  if (Number.isFinite(start) || Number.isFinite(end)) return "IN_AUCTION";
  return str(auction.AuctionType || auction.SaleType);
}

export function mapOpenlaneAuction(auction, anchors = [], nowMs = Date.now()) {
  const requested = auction.RequestedSalesPrice;
  const requestedShown = auction.RequestedSalesPriceCanBeShown ?? auction.CanBeShown ?? true;
  const title = str(auction.CarNameEn || auction.CarName || auction.Title);
  const isMargin = coerceOpenlaneMargin(auction.IsMargin ?? auction.isMargin);
  const vatNote = pickOpenlaneVatNote(auction);
  const item = makeItem("openlane", {
    externalId: str(auction.AuctionId) || str(auction.CarId),
    auctionId: str(auction.AuctionId),
    detailUrl: detailUrlFor(auction, anchors),
    title,
    manufacturer: str(auction.Make || auction.MakeName) || title.split(" ")[0],
    year: yearOf(auction.FirstRegistrationDate || auction.RegistrationDate || auction.Year || auction.BuildYear),
    firstRegistration: isoDate(auction.FirstRegistrationDate || auction.RegistrationDate).slice(0, 10),
    mileageKm: num(auction.Mileage),
    fuel: str(auction.FuelType || auction.Fuel),
    transmission: str(auction.Transmission || auction.TransmissionType || auction.Gearbox),
    powerKw: str(auction.PowerKw || auction.KW || auction.Power),
    location: str(auction.LocationName || auction.City || auction.Location),
    countryCode: str(auction.CountryCode || auction.OriginCountry || auction.Country),
    imageUrl: str(auction.ThumbnailUrl || auction.ImageUrl),
    currency: str(auction.Currency) || "EUR",
    priceStart: price(auction.StartPrice),
    priceCurrent: price(auction.CurrentPrice ?? auction.MaximumBid),
    priceMinimal: requestedShown ? price(requested) : null,
    priceBuyNow: price(auction.BuyNowPrice),
    vatNote,
    auctionStartAt: isoDate(auction.BatchStartDate),
    auctionEndAt: isoDate(auction.BatchEndDate),
    auctionStage: stageFor(auction, nowMs),
  });
  return {
    ...item,
    isMargin,
    vatRate: num(auction.VatRate ?? auction.VatPercentage ?? auction.VATPercentage ?? auction.VatPercent),
    bidCount: num(auction.BidCount ?? auction.NumberOfBids),
    damageRaw: str(auction.DamageDescription || auction.DamageText || auction.Comments || ""),
  };
}
