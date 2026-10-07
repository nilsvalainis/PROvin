/**
 * Auto1 merchant saraksts ir SPA aiz login. Sesija turas ilgi, tāpēc tikai pastāvīgs profils,
 * bez auto-login: ja izlogots -> login_required (Nils ielogojas caur noVNC).
 *
 * Datus ņem no SPA iekšējiem XHR/JSON (ne DOM): pārtver visas JSON atbildes no auto1 domēniem,
 * kurās ir masīvs ar auto objektiem, un mapē pēc lauku nosaukumiem. Pamanītie API URL tiek
 * saglabāti state (health.platforms.auto1.discoveredApis), lai mapējumu var precizēt pēc pirmās
 * ielogošanās. `AUTO1_LIST_API_RE` ļauj fiksēt konkrēto endpointu, kad tas ir zināms.
 */
import { hasCaptchaOrChallenge, pageText, randomPause } from "../browser.mjs";
import { isoDate, makeItem, num, price, str, yearOf } from "../items.mjs";

const PROBE_URL = process.env.AUTO1_PROBE_URL || "https://www.auto1.com/en/app/merchant/cars?channel=24h&page=1";
const LOGGED_OUT_URL_RE = /\/merchant\/signin|\/login\b|\/signin\b/i;
const LIST_API_RE = process.env.AUTO1_LIST_API_RE ? new RegExp(process.env.AUTO1_LIST_API_RE, "i") : null;
const API_HOST_RE = /auto1(?:\.com|\.cloud|\.eu|-group\.com)/i;
const DETAIL_TEMPLATE = process.env.AUTO1_DETAIL_URL_TEMPLATE || "https://www.auto1.com/en/app/merchant/car/{id}";

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

function pick(obj, patterns) {
  for (const [k, v] of Object.entries(obj)) {
    if (patterns.some((re) => re.test(k)) && v !== null && v !== undefined && v !== "") return v;
  }
  return undefined;
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

export function mapAuto1Car(car) {
  const id = str(pick(car, [/^(id|uuid|stockNumber|stock_number|vehicleId|carId|externalId)$/i]));
  const make = str(pick(car, [/^(manufacturer|make|brand)(Name)?$/i]) ?? "");
  const makeName = typeof make === "object" ? str(make?.name) : str(make);
  const model = pick(car, [/^(model|modelName|mainType|subType)$/i]);
  const modelName = typeof model === "object" ? str(model?.name) : str(model);
  const title = str(pick(car, [/^(title|name|fullName|displayName|headline)$/i])) || [makeName, modelName, str(pick(car, [/^(subType|variant|engine|trim)$/i]))].filter(Boolean).join(" ");
  const reg = pick(car, [/^(firstRegistration|firstRegistrationDate|registrationDate|registration|builtYear|buildYear|year)$/i]);
  const priceObj = pick(car, [/^(price|prices|pricing)$/i]);
  const flat = { ...car, ...(priceObj && typeof priceObj === "object" ? priceObj : {}) };
  const currentPrice = price(pick(flat, [/^(currentPrice|currentBid|highestBid|bid|price|amount|netPrice|grossPrice|minimumBid)$/i]));
  const startPrice = price(pick(flat, [/^(startPrice|startingPrice|minPrice|minimumPrice)$/i]));
  const buyNow = price(pick(flat, [/^(buyNowPrice|buyNow|fixedPrice|instantPrice)$/i]));
  const image = pick(car, [/^(image|imageUrl|thumbnail|thumbnailUrl|mainImage|coverImage|images|pictures)$/i]);
  const imageUrl = Array.isArray(image) ? str(image[0]?.url ?? image[0]?.src ?? image[0]) : typeof image === "object" && image ? str(image.url ?? image.src) : str(image);
  const location = pick(car, [/^(location|branch|branchName|city|pickupLocation|locationName)$/i]);
  const start = pick(car, [/^(auctionStart|auctionStartDate|startDate|startTime|startsAt)$/i]);
  const end = pick(car, [/^(auctionEnd|auctionEndDate|endDate|endTime|endsAt|expiresAt)$/i]);
  const country = pick(car, [/^(country|countryCode|originCountry|locationCountry)$/i]);
  return makeItem("auto1", {
    externalId: id,
    auctionId: str(pick(car, [/^(auctionId|auction|batchId)$/i])),
    detailUrl: str(pick(car, [/^(url|link|detailUrl|href|permalink)$/i])) || DETAIL_TEMPLATE.replace("{id}", encodeURIComponent(id)),
    title,
    manufacturer: makeName,
    year: yearOf(reg),
    firstRegistration: str(reg).slice(0, 10),
    mileageKm: num(pick(car, [/^(mileage|km|kilometers|odometer|mileageKm)$/i])),
    fuel: str(pick(car, [/^(fuel|fuelType)$/i])),
    transmission: str(pick(car, [/^(gearType|gearbox|transmission|transmissionType)$/i])),
    powerKw: str(pick(car, [/^(powerKw|kw|power)$/i])),
    location: typeof location === "object" && location ? str(location.name ?? location.city) : str(location),
    countryCode: typeof country === "object" && country ? str(country.code ?? country.isoCode) : str(country),
    imageUrl,
    currency: str(pick(flat, [/^currency$/i])) || "EUR",
    priceStart: startPrice,
    priceCurrent: currentPrice,
    priceMinimal: null,
    priceBuyNow: buyNow,
    vatNote: str(pick(flat, [/^(vatType|taxType|vat|vatDeductible)$/i])),
    auctionStartAt: isoDate(start),
    auctionEndAt: isoDate(end),
    auctionStage: str(pick(car, [/^(status|state|stage|auctionStatus)$/i])),
  });
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
