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

const FUEL_KEYS = ["FuelType", "Fuel", "FuelTypeName", "FuelName", "FuelTypeText", "FuelDescription", "EnergyType", "Energy", "FuelTypeLabel"];
const GEAR_KEYS = ["Transmission", "TransmissionType", "Gearbox", "GearboxType", "TransmissionName", "GearType", "GearboxName", "TransmissionLabel"];
const FUEL_RULES = [
  { re: /^(mild[-\s]?hybrid|mhev)$/i, value: "Mild-Hybrid" },
  { re: /^(plug[-\s]?in([-\s]?hybrid)?|phev)$/i, value: "Plug-in Hybrid" },
  { re: /^(hybrid|hev|petrol\/electric|diesel\/electric)$/i, value: "Hybrid" },
  { re: /^(petrol|gasoline|benzine?|benzin|essence|bleifrei)$/i, value: "Petrol" },
  { re: /^(diesel|dizel|gasoil)$/i, value: "Diesel" },
  { re: /^(electric|elektro|ev|bev)$/i, value: "Electric" },
  { re: /^(lpg|autogas|gpl)$/i, value: "LPG" },
  { re: /^(cng|methane)$/i, value: "CNG" },
  { re: /^(hydrogen|h2)$/i, value: "Hydrogen" },
];
const GEAR_RULES = [
  { re: /^(automatic|automatik|automats|auto|dsg|dct|cvt|tiptronic)$/i, value: "Automatic" },
  { re: /^(manual|manuell|mechanic|schaltgetriebe)$/i, value: "Manual" },
];

function foldKey(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function labeledFromUnknown(v, depth = 0) {
  if (depth > 3 || v == null) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "0") return "";
    return s;
  }
  if (typeof v === "number") return "";
  if (typeof v === "object" && !Array.isArray(v)) {
    for (const k of ["Name", "name", "Text", "text", "Label", "label", "Value", "value", "Description", "description"]) {
      const s = labeledFromUnknown(v[k], depth + 1);
      if (s) return s;
    }
  }
  return "";
}

function firstLabeled(auction, keys) {
  if (!auction || typeof auction !== "object") return "";
  for (const k of keys) {
    const s = labeledFromUnknown(auction[k]);
    if (s) return s;
  }
  return "";
}

function matchSpecRule(raw, rules) {
  const s = String(raw || "").trim();
  if (!s || s === "0") return "";
  const folded = foldKey(s);
  for (const rule of rules) {
    if (rule.re.test(s) || rule.re.test(folded)) return rule.value;
  }
  return "";
}

export function normalizeOpenlaneFuel(raw) {
  return matchSpecRule(raw, FUEL_RULES);
}

export function normalizeOpenlaneTransmission(raw) {
  return matchSpecRule(raw, GEAR_RULES);
}

/** Virsraksta beigu ` - Fuel - Gearbox` segmenti. */
export function parseOpenlaneTitleFuelTransmission(title) {
  const segs = String(title || "")
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let fuel = "";
  let transmission = "";
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    if (!transmission) {
      const g = normalizeOpenlaneTransmission(seg);
      if (g) {
        transmission = g;
        continue;
      }
    }
    if (!fuel) {
      const f = normalizeOpenlaneFuel(seg);
      if (f) fuel = f;
    }
    if (fuel && transmission) break;
  }
  return { fuel, transmission };
}

export function pickOpenlaneFuelTransmission(auction, title) {
  const fromTitle = parseOpenlaneTitleFuelTransmission(title);
  return {
    fuel: normalizeOpenlaneFuel(firstLabeled(auction, FUEL_KEYS)) || fromTitle.fuel,
    transmission: normalizeOpenlaneTransmission(firstLabeled(auction, GEAR_KEYS)) || fromTitle.transmission,
  };
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

/** Openlane `0001-01-01T00:00:00` u.c. tukšie datumi -> "". */
function realDate(v) {
  const s = str(v);
  const literal = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const iso = literal ? literal[1] : isoDate(v);
  const y = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) && y >= 1900 ? iso.slice(0, 10) : "";
}

/**
 * findcarv6/search: pirmā reģistrācija ir `DateFirstRegistration` ("2017-02-07T00:00:00").
 * `CarIdentification.Year` parasti ir "". Virsrakstā gada nav, bet atstājam fallback.
 */
export function pickOpenlaneRegistration(auction, title = "") {
  const firstRegistration =
    realDate(auction.DateFirstRegistration) || realDate(auction.FirstRegistrationDate) || realDate(auction.RegistrationDate);
  const year =
    yearOf(firstRegistration) ||
    yearOf(auction.CarIdentification?.Year) ||
    yearOf(auction.Year || auction.BuildYear) ||
    (String(title).match(/\b((?:19|20)\d{2})\b(?!\.\d)/)?.[1] ?? "");
  return { year, firstRegistration };
}

export function mapOpenlaneAuction(auction, anchors = [], nowMs = Date.now()) {
  const requested = auction.RequestedSalesPrice;
  const requestedShown = auction.RequestedSalesPriceCanBeShown ?? auction.CanBeShown ?? true;
  const title = str(auction.CarNameEn || auction.CarName || auction.Title);
  const isMargin = coerceOpenlaneMargin(auction.IsMargin ?? auction.isMargin);
  const vatNote = pickOpenlaneVatNote(auction);
  const spec = pickOpenlaneFuelTransmission(auction, title);
  const reg = pickOpenlaneRegistration(auction, title);
  const item = makeItem("openlane", {
    externalId: str(auction.AuctionId) || str(auction.CarId),
    auctionId: str(auction.AuctionId),
    detailUrl: detailUrlFor(auction, anchors),
    title,
    manufacturer: str(auction.Make || auction.MakeName || auction.CleanMake || auction.CarIdentification?.Make) || title.split(" ")[0],
    year: reg.year,
    firstRegistration: reg.firstRegistration,
    mileageKm: num(auction.Mileage),
    fuel: spec.fuel,
    transmission: spec.transmission,
    powerKw: str(auction.Kw || auction.PowerKw || auction.KW || auction.Power),
    location: str(auction.LocationName || auction.City || auction.Location),
    countryCode: str(auction.CountryCode || auction.OriginCountry || auction.Country || auction.CarCountryExtended || auction.CountryCodeDealer).toUpperCase(),
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
