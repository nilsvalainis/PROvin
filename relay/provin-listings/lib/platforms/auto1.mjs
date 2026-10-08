/**
 * Auto1 merchant saraksts ir SPA aiz login. Sesija turas ilgi, tāpēc tikai pastāvīgs profils,
 * bez auto-login: ja izlogots -> login_required (Nils ielogojas caur noVNC).
 *
 * Datus ņem no SPA XHR `GET /v1/car-search/cars/search/<searchId>`
 * (`{totalHits, hits[], aggregations, serverTime}`). Cenas ir centos. `firstRegistrationDate`,
 * `auctionStartDatetime` un `auctionEndDatetime` ir ms. Detaļu saite lieto `stockNumber`
 * (`/en/app/merchant/car/BW03512`), ne skaitlisko `id`. VIN sarakstā nav.
 * `img-pa.auto1.com` strādā ar provin.lv Referer, tāpēc admin lapā no-referrer nav vajadzīgs.
 */
import { hasCaptchaOrChallenge, pageText, randomPause } from "../browser.mjs";
import { isoDate, makeItem, num, str, yearOf } from "../items.mjs";

const PROBE_URL = process.env.AUTO1_PROBE_URL || "https://www.auto1.com/en/app/merchant/cars?channel=24h&page=1";
const LOGGED_OUT_URL_RE = /\/merchant\/signin|\/login\b|\/signin\b/i;
const DEFAULT_LIST_API_RE = "/v1/car-search/cars/search/";
const API_HOST_RE = /auto1(?:\.com|\.cloud|\.eu|-group\.com)/i;
const DETAIL_TEMPLATE = process.env.AUTO1_DETAIL_URL_TEMPLATE || "https://www.auto1.com/en/app/merchant/car/{stockNumber}";

export function auto1ListApiRe(pattern = process.env.AUTO1_LIST_API_RE) {
  return new RegExp(pattern || DEFAULT_LIST_API_RE, "i");
}

const LIST_API_RE = auto1ListApiRe();

export const auto1 = {
  id: "auto1",
  label: "Auto1",
  hasCredentials: () => false,
  loginUrl: "https://www.auto1.com/en/merchant/signin",
  probeUrl: PROBE_URL,
  isLoggedIn,
  login: async () => ({ ok: false, status: "login_required", note: "Auto1: automātisku login neveicam, jāielogojas manuāli (noVNC)." }),
  fetchSource,
};

async function isLoggedIn(page) {
  if (LOGGED_OUT_URL_RE.test(page.url())) return false;
  const text = await pageText(page, 6_000);
  if (/\bSign in\b.{0,80}\bPassword\b/i.test(text) || /\bAnmelden\b.{0,80}\bPasswort\b/i.test(text)) return false;
  return true;
}

function looksLikeCar(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const keys = Object.keys(o).join(" ").toLowerCase();
  const hasId = /\b(id|uuid|stocknumber|stock_number|vehicleid|carid)\b/.test(keys);
  const hasCarish = /(manufacturer|make|brand|model|title|mileage|km|price|registration|vin)/.test(keys);
  return hasId && hasCarish && Object.keys(o).length >= 5;
}

/** Atrod dziļāko masīvu ar auto objektiem jebkurā JSON. */
export function findCarArrays(json, depth = 0, out = []) {
  if (depth > 8 || !json || typeof json !== "object") return out;
  if (Array.isArray(json)) {
    if (json.length >= 1 && json.filter(looksLikeCar).length >= Math.max(1, Math.floor(json.length * 0.6))) out.push(json.filter(looksLikeCar));
    else for (const x of json) findCarArrays(x, depth + 1, out);
    return out;
  }
  for (const v of Object.values(json)) findCarArrays(v, depth + 1, out);
  return out;
}

/** Auto1 cenas ir centos. 0 un tukšs nav cena. */
export function eurosFromCents(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : num(v);
  if (n === null || !(n > 0)) return null;
  return Math.round(n / 100);
}

function registrationFromMs(v) {
  const iso = isoDate(v);
  if (!iso || Number.isNaN(Date.parse(iso))) return { year: "", firstRegistration: "" };
  return { year: iso.slice(0, 4), firstRegistration: iso.slice(0, 10) };
}

function auto1Title(car) {
  const make = str(car.manufacturerName);
  const model = str(car.modelDescription) || [str(car.mainType), str(car.subType)].filter(Boolean).join(" ");
  return [make, model].filter(Boolean).join(" ");
}

function auto1Image(car) {
  const main = str(car.mainImageFullUrl);
  if (main) return main;
  const images = Array.isArray(car.images) ? car.images : [];
  const first = images.find((img) => img && str(img.fullUrl));
  return first ? str(first.fullUrl) : "";
}

function auto1Location(car) {
  const loc = car.currentLocation;
  if (!loc || typeof loc !== "object") return "";
  return [str(loc.city), str(loc.country)].filter(Boolean).join(", ");
}

function auto1DetailUrl(car) {
  const stock = str(car.stockNumber);
  const id = str(car.id);
  const key = stock || id;
  return DETAIL_TEMPLATE.replaceAll("{stockNumber}", encodeURIComponent(key)).replaceAll("{id}", encodeURIComponent(key));
}

/** Laika stadija. `auctionType` (24D1 u.c.) paliek atsevišķā laukā, nav auctionStage. */
export function auto1Stage(car, nowMs = Date.now()) {
  const start = Date.parse(isoDate(car.auctionStartDatetime));
  const end = Date.parse(isoDate(car.auctionEndDatetime));
  if (Number.isFinite(start) && nowMs < start) return "BEFORE_AUCTION";
  if (Number.isFinite(end) && nowMs > end) return "AFTER_AUCTION";
  if (Number.isFinite(start) || Number.isFinite(end)) return "IN_AUCTION";
  const sec = num(car.auctionSecLeft);
  if (sec === null) return "";
  return sec > 0 ? "IN_AUCTION" : "AFTER_AUCTION";
}

export function mapAuto1Car(car, nowMs = Date.now()) {
  const reg = registrationFromMs(car.firstRegistrationDate);
  const stock = str(car.stockNumber);
  const item = makeItem("auto1", {
    externalId: str(car.id),
    auctionId: str(car.auctionIdentifier),
    detailUrl: auto1DetailUrl(car),
    title: auto1Title(car),
    manufacturer: str(car.manufacturerName),
    year: reg.year || yearOf(car.builtYear || car.buildYear || car.year),
    firstRegistration: reg.firstRegistration,
    mileageKm: num(car.km),
    fuel: str(car.fuelType ?? car.fuel),
    transmission: str(car.gearType ?? car.transmission),
    powerKw: str(car.kw),
    location: auto1Location(car),
    countryCode: str(car.countryCode),
    imageUrl: auto1Image(car),
    currency: "EUR",
    priceStart: eurosFromCents(car.auctionStartPrice),
    priceCurrent: eurosFromCents(car.lastTopBidValue),
    priceMinimal: eurosFromCents(car.minimumBid),
    priceBuyNow: eurosFromCents(car.buyNowPrice),
    vatNote: car.salesVatType != null ? `salesVatType ${car.salesVatType}` : "",
    auctionStartAt: isoDate(car.auctionStartDatetime),
    auctionEndAt: isoDate(car.auctionEndDatetime),
    auctionStage: auto1Stage(car, nowMs),
  });
  const finance = car.meta && typeof car.meta === "object" ? car.meta.finance : car.finance;
  const imageUrls = (Array.isArray(car.images) ? car.images : []).map((img) => str(img?.fullUrl ?? img?.url ?? img)).filter(Boolean);
  return {
    ...item,
    stockNumber: stock,
    expectedPrice: eurosFromCents(car.expectedPriceDisplay),
    salesVatType: num(car.salesVatType),
    taxDeduction: typeof car.taxDeduction === "boolean" ? car.taxDeduction : null,
    vatRate: num(car.vatRate ?? (finance && typeof finance === "object" ? finance.vatRate : null)),
    imageUrls: imageUrls.length ? imageUrls.slice(0, 40) : undefined,
    bidCount: num(car.bidCount ?? car.numberOfBids),
    auctionType: str(car.auctionType),
    damageRaw: str(car.damageDescription ?? car.damageText ?? car.conditionComment ?? ""),
  };
}

async function fetchSource(page, sourceUrl, { maxPages, log, state }) {
  const candidates = [];
  const onResponse = async (res) => {
    const url = res.url();
    if (!API_HOST_RE.test(url)) return;
    if (LIST_API_RE && !LIST_API_RE.test(url)) return;
    const ct = res.headers()["content-type"] ?? "";
    if (!/json/i.test(ct)) return;
    try {
      const json = await res.json();
      const arrays = findCarArrays(json);
      if (arrays.length === 0) return;
      state?.addDiscoveredApi("auto1", url);
      candidates.push({ url, json, cars: arrays.sort((a, b) => b.length - a.length)[0] });
    } catch {
      /* ne JSON */
    }
  };
  page.on("response", onResponse);
  try {
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(2_500, 4_500);
    if (!(await isLoggedIn(page))) return fail("login_required", "Auto1 merchant sesija beigusies: jāielogojas no jauna.");
    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge) return fail("blocked", `Auto1 rāda ${challenge}.`);

    const deadline = Date.now() + 25_000;
    while (candidates.length === 0 && Date.now() < deadline) await randomPause(500, 900);
    if (candidates.length === 0) return fail("error", "Auto1 SPA JSON ar auto sarakstu netika pamanīts. Skat. health.platforms.auto1.discoveredApis un iestati AUTO1_LIST_API_RE.");

    const items = new Map();
    const rawPages = [];
    const addFrom = (c) => {
      rawPages.push({ url: c.url, json: c.json });
      for (const car of c.cars) {
        const item = mapAuto1Car(car);
        if (item.externalId && item.title && !items.has(item.externalId)) items.set(item.externalId, item);
      }
    };
    addFrom(candidates.sort((a, b) => b.cars.length - a.cars.length)[0]);

    /** Lapošana: ja URL ir `page=N`, ielādē nākamās lapas un gaida jaunu JSON. */
    const u = new URL(sourceUrl);
    if (u.searchParams.has("page")) {
      for (let p = 2; p <= maxPages; p += 1) {
        const before = candidates.length;
        u.searchParams.set("page", String(p));
        await randomPause(1_500, 3_000);
        await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
        const d2 = Date.now() + 15_000;
        while (candidates.length === before && Date.now() < d2) await randomPause(400, 800);
        if (candidates.length === before) break;
        const sizeBefore = items.size;
        addFrom(candidates[candidates.length - 1]);
        if (items.size === sizeBefore) break;
      }
    }
    log(`auto1 ${items.size} auto no ${candidates.length} JSON atbildēm`);
    return {
      status: "ok",
      note: items.size === 0 ? "JSON pamanīts, bet neviens auto netika mapēts; skat. raw." : "",
      items: [...items.values()],
      raw: { kind: "auto1-xhr", pages: rawPages },
      pagesFetched: rawPages.length,
      pageCount: rawPages.length,
    };
  } catch (e) {
    return fail("error", e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda");
  } finally {
    page.off("response", onResponse);
  }
}

function fail(status, note) {
  return { status, note, items: [], raw: null, pagesFetched: 0, pageCount: 0 };
}
