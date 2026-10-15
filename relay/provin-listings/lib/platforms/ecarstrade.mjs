/**
 * eCarsTrade cenas un auto kartītes īstā Chrome (pastāvīgs profils).
 * Atgriež items[] (solījums + PIRKT). Inventāra fallback Vercel paliek future_api.php. Relejs:
 * 1) saglabā JWT/PHPSESSID ar derīguma termiņu (sesijas sīkdatne citādi pazūd, kad Chrome aizveras);
 * 2) neprobe /search tukšu (viesiem tas dzēš eCT/user);
 * 3) kartītes ņem no JS vai no future_api.php pašā pārlūkā (ar CF/sīkdatnēm).
 * Paroles: ECARSTRADE_USER / ECARSTRADE_PASS (tikai /etc/provin-listings.env).
 */
import { hasCaptchaOrChallenge, pageText, randomPause } from "../browser.mjs";
import { makeItem, price as toPrice } from "../items.mjs";

const ORIGIN = "https://ecarstrade.com";
const AUTH_PATH = "/api/v1/auth/login";
const WARMUP_PATH = "/setsession.php";
const COOKIE_MAX_AGE_SEC = 14 * 24 * 60 * 60;
const LOGIN_RETRY_STATUSES = new Set([520, 521, 522, 523, 524, 502, 503, 429]);
const LOGGED_IN_RE = new RegExp(
  process.env.ECARSTRADE_LOGGED_IN_TEXT || "(log ?out|iziet|sign out|my account|mans konts|pirkt uzreiz|\\bpirkt\\b)",
  "i",
);

export const ecarstrade = {
  id: "ecarstrade",
  label: "eCarsTrade",
  hasCredentials: () => Boolean(process.env.ECARSTRADE_USER && process.env.ECARSTRADE_PASS),
  loginUrl: process.env.ECARSTRADE_LOGIN_URL || `${ORIGIN}${WARMUP_PATH}`,
  /** Tukšs /search viesiem dzēš eCT/user. Sesiju pārbauda šeit. */
  probeUrl: process.env.ECARSTRADE_PROBE_URL || `${ORIGIN}${WARMUP_PATH}`,
  isLoggedIn,
  persistSession,
  login,
  fetchSource,
};

export function ecarstradeRelaySearchPageUrl(sourceUrl, page, perPage = 20) {
  const u = new URL(sourceUrl);
  const start = page <= 1 ? 0 : (page - 1) * perPage;
  if (start > 0) u.searchParams.set("start", String(start));
  else u.searchParams.delete("start");
  return u.toString();
}

export function ecarstradeRelayApiUrl(sourceUrl, start = 0, perPage = 20) {
  const src = new URL(sourceUrl);
  const api = new URL(`${ORIGIN}/future_api.php`);
  api.searchParams.set("request_type", "cars");
  api.searchParams.set("auction_type", "search");
  api.searchParams.set("start", String(Math.max(0, start)));
  api.searchParams.set("perpage", String(Math.max(1, perPage)));
  const sort = src.searchParams.get("sort")?.trim() || "time_left.asc";
  api.searchParams.set("sort", sort.includes(".") ? sort : `${sort}.asc`);
  for (const [key, value] of src.searchParams.entries()) {
    if (key === "sort" || key === "start" || key === "perpage" || key === "page") continue;
    if (key.startsWith("iriss_")) continue;
    if (!value.trim()) continue;
    api.searchParams.append(key, value);
  }
  return api.toString();
}

export function ecarstradeRelayDetailUrl(id) {
  const clean = String(id ?? "").replace(/\D/g, "");
  return clean ? `${ORIGIN}/cars/${clean}` : "";
}

export function collectEcarstradeCardIds(html) {
  const ids = [];
  const re = /data-itemId=["'](\d+)["']/gi;
  let m;
  while ((m = re.exec(String(html ?? "")))) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/** Kartīte bez PIRKT / cenas (publiskais „Sign in to buy”). */
export function ecarstradeCardNeedsPrice(htmlSlice) {
  const s = String(htmlSlice ?? "");
  if (/sign in to buy/i.test(s)) return true;
  if (/aplēs|estimated price|estimate price|appraisal/i.test(s) && /€|eur/i.test(s)) return false;
  if (/\b(?:pirkt uzreiz|buy now|pirkt)\b/i.test(s) && /€|eur/i.test(s)) return false;
  return !/€\s*\d|\d[\d.\s]*\s*€/i.test(s);
}

export function ecarstradeItemNeedsPrice(item) {
  return Boolean(item) && item.priceBuyNow == null && item.priceCurrent == null && item.priceEstimate == null;
}

/** Viena kartīte līdz nākamajam data-itemId, lai nākamā auto € neaizēno šo. */
export function ecarstradeIsolatedCardSlice(html, matchIndex) {
  const text = String(html ?? "");
  const idx = Math.max(0, matchIndex);
  const nextRel = text.slice(idx + 1).search(/data-itemId=["']\d+["']/i);
  const end = nextRel >= 0 ? idx + 1 + nextRel : Math.min(text.length, idx + 8_000);
  const start = text.lastIndexOf("<div", idx);
  return text.slice(Math.max(0, start), end);
}

export function idsNeedingDetailPrice(html) {
  const text = String(html ?? "");
  const missing = [];
  const re = /data-itemId=["'](\d+)["']/gi;
  let m;
  while ((m = re.exec(text))) {
    const id = m[1];
    if (!id || missing.includes(id)) continue;
    if (ecarstradeCardNeedsPrice(ecarstradeIsolatedCardSlice(text, m.index))) missing.push(id);
  }
  return missing;
}

export function collectIdsNeedingPrice(items, html, extraIds = []) {
  const ids = new Set();
  for (const it of items ?? []) {
    const id = it?.externalId ? String(it.externalId).replace(/\D/g, "") : "";
    if (id && ecarstradeItemNeedsPrice(it)) ids.add(id);
  }
  for (const id of idsNeedingDetailPrice(html)) ids.add(id);
  for (const raw of extraIds ?? []) {
    const id = String(raw ?? "").replace(/\D/g, "");
    if (id) ids.add(id);
  }
  return [...ids];
}

/** future_api 404 / tukšs inventārs. Nav CF/403 un nav parse kļūda. */
export function isEcarstradeFutureApiTrulyEmpty(api) {
  const status = Number(api?.status);
  const text = String(api?.text ?? "").trim();
  if (status === 404) return true;
  if (status !== 200 && status !== 204) return false;
  if (/cloudflare|cf-challenge|just a moment|attention required/i.test(text) && /<html/i.test(text)) return false;
  if (collectEcarstradeCardIds(htmlFromEcarstradeApiBody(text)).length) return false;
  if (itemsFromEcarstradeApiBody(text).length) return false;
  if (!text || text === "{}" || text === "[]" || text === "null") return true;
  if (/^\s*(\{\}\s*)+$/.test(text)) return true;
  const objs = splitConcatenatedJsonObjects(text);
  if (objs.length === 0) {
    try {
      const j = JSON.parse(text);
      if (!j || typeof j !== "object") return false;
      const st = j.status ?? j.code ?? j.error_code;
      if (st === 404 || st === "404") return true;
      if (j.error && /not found|no (?:cars|results|stock)/i.test(String(j.error))) return true;
      if (Array.isArray(j.data) && j.data.length === 0) return true;
      if (j.data == null && !j.result && !j.car_id) return true;
      return true;
    } catch {
      return false;
    }
  }
  return objs.every((o) => {
    const st = o.status ?? o.code;
    return st === 404 || st === "404" || (!o.result && !o.data && !o.car_id);
  });
}

function splitConcatenatedJsonObjects(raw) {
  const out = [];
  let buf = "";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (const ch of String(raw ?? "")) {
    if (depth === 0 && !ch.trim()) continue;
    buf += ch;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const t = buf.trim();
        buf = "";
        if (!t || t === "{}") continue;
        try {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) out.push(parsed);
        } catch {
          /* nederīgs gabals */
        }
      }
    }
  }
  return out;
}

export function htmlFromEcarstradeApiBody(raw) {
  const text = String(raw ?? "");
  if (!text.trim()) return "";
  if (/data-itemId=/i.test(text) && !/"car_id"\s*:/.test(text)) return text;
  const cards = [];
  for (const obj of splitConcatenatedJsonObjects(text)) {
    const b64 = typeof obj.result === "string" ? obj.result : "";
    if (!b64) continue;
    try {
      const html = Buffer.from(b64, "base64").toString("utf8");
      if (html) cards.push(html);
    } catch {
      /* ignorē */
    }
  }
  return cards.join("\n");
}

function stripTags(s) {
  return String(s ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function euroAmounts(raw) {
  const out = [];
  const text = String(raw ?? "").replace(/\u00a0/g, " ");
  const re =
    /(?:€|eur)\s*(\d{1,3}(?:[.\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)|(\d{1,3}(?:[.\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s*(?:€|eur)/gi;
  for (const m of text.matchAll(re)) {
    const n = toPrice(m[1] || m[2]);
    if (n != null && n >= 100) out.push(n);
  }
  return out;
}

function amountAfter(raw, label) {
  const flags = label.flags.includes("g") ? label.flags : `${label.flags}g`;
  const re = new RegExp(label.source, flags);
  const text = String(raw ?? "");
  for (const m of text.matchAll(re)) {
    const n = euroAmounts(text.slice(m.index, m.index + 180))[0];
    if (n != null) return n;
  }
  return null;
}

function tagAttr(tag, name) {
  return (new RegExp(`${name}=["']([^"']*)["']`, "i").exec(tag)?.[1] ?? "").trim();
}

function tagHasClass(tag, token) {
  const cls = /class=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
  return new RegExp(`(?:^|\\s)${token}(?:\\s|$)`, "i").test(cls);
}

function itemBidButtonTags(html) {
  const out = [];
  const re = /<(?:a|button)\b[^>]*\bitem-bid-button\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(html ?? "")))) out.push({ tag: m[0], index: m.index });
  return out;
}

function inferAuctionTypeFromButtons(html) {
  const tags = itemBidButtonTags(html);
  if (tags.some((t) => tagHasClass(t.tag, "fix"))) return "fix";
  if (tags.some((t) => tagHasClass(t.tag, "bid"))) return "bid";
  return "";
}

/** Logged-in /cars/{id}: a.item-bid-button.fix[data-price], not nav „Buy”. */
function buyNowFromFixButtons(html) {
  const s = String(html ?? "");
  for (const b of itemBidButtonTags(s)) {
    if (!tagHasClass(b.tag, "fix")) continue;
    const fromAttr = toPrice(tagAttr(b.tag, "data-price"));
    if (fromAttr != null) return fromAttr;
    const after = s.slice(b.index + b.tag.length);
    const close = after.search(/<\/(?:a|button)>/i);
    const inner = stripTags(after.slice(0, close >= 0 ? close : 200));
    const fromText = euroAmounts(inner)[0] ?? toPrice(inner);
    if (fromText != null) return fromText;
  }
  return null;
}

function buyNowFromBuyOrOfferHref(html) {
  const m = /(?:data-href|href)=["'][^"']*buy_or_offer\?[^"']*\bbid=(\d+)/i.exec(String(html ?? ""));
  return m ? toPrice(m[1]) : null;
}

function buyNowFromCalcBid(html) {
  const s = String(html ?? "");
  const input = /<input\b[^>]*\bid=["']calc_bid["'][^>]*>/i.exec(s);
  if (input) {
    const n = toPrice(tagAttr(input[0], "value"));
    if (n != null) return n;
  }
  const wrap = /<(\w+)\b[^>]*\bid=["']calc_bid["'][^>]*>([\s\S]*?)<\/\1>/i.exec(s);
  if (wrap) {
    const n = toPrice(stripTags(wrap[2] ?? ""));
    if (n != null) return n;
  }
  return null;
}

/** BID „Place a bid”, empty data-price: genuinely unpriced, not a parse miss. */
export function isEcarstradeBidNoBidsHtml(html) {
  const tags = itemBidButtonTags(html);
  const fix = tags.some((t) => tagHasClass(t.tag, "fix"));
  const bidOnly = tags.filter((t) => tagHasClass(t.tag, "bid") && !tagHasClass(t.tag, "fix"));
  if (fix || bidOnly.length === 0) return false;
  return bidOnly.every((t) => toPrice(tagAttr(t.tag, "data-price")) == null);
}

function amountInClass(html, cls) {
  const re = new RegExp(`class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)</(?:div|span|button|a|strong)`, "i");
  const m = html.match(re);
  if (!m) return null;
  const text = stripTags(m[1] ?? "");
  return euroAmounts(text)[0] ?? toPrice(text);
}

const ESTIMATE_LABEL = /Aplēses cena|Estimated price|Estimate price|Appraisal(?: price)?|Suggested price|Ieteicamā cena|Recommended bid|Min\.?\s*Market Price/i;
const TOTAL_LABEL = /Kopējā cena|Total price|Total amount/i;
const BUY_LABEL = /Pirkt uzreiz|Buy now|\bPIRKT\b|\bBUY\b/i;

function dataPriceInClass(html, cls) {
  const re = new RegExp(`<[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>`, "gi");
  for (const m of String(html ?? "").matchAll(re)) {
    const n = toPrice(tagAttr(m[0] ?? "", "data-price"));
    if (n != null) return n;
  }
  return null;
}

function headLabelPrice(html) {
  const label = stripTags(/class=["'][^"']*car-price__head-label__label[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? "");
  const amount = amountInClass(html, "car-price__head-label__value");
  if (!label && amount == null) return null;
  return { label, amount };
}

function estimateFromHtml(html, bidNoBids) {
  const labeled = amountAfter(html, ESTIMATE_LABEL);
  if (labeled != null) return labeled;
  const head = headLabelPrice(html);
  if (head?.amount != null && ESTIMATE_LABEL.test(head.label)) return head.amount;
  const fromData = dataPriceInClass(html, "recommended-bid") ?? dataPriceInClass(html, "min-market-price") ?? dataPriceInClass(html, "estimate");
  if (fromData != null) return fromData;
  if (bidNoBids) return buyNowFromCalcBid(html);
  return null;
}

function totalFromHtml(html) {
  return amountAfter(html, TOTAL_LABEL) ?? amountInClass(html, "car-price__calc");
}

function buyNowFromHeadLabel(html) {
  const head = headLabelPrice(html);
  if (!head?.amount || !BUY_LABEL.test(head.label) || ESTIMATE_LABEL.test(head.label)) return null;
  if (/pirkt\s*\/\s*sol/i.test(head.label)) return null;
  return head.amount;
}

function buyNowLabeledAmount(raw) {
  const re = /PIRKT|BUY(?:\s+NOW)?|Buy now|Pirkt uzreiz/gi;
  const text = String(raw ?? "");
  for (const m of text.matchAll(re)) {
    const around = text.slice(m.index, m.index + 18);
    if (/pirkt\s*\/\s*sol/i.test(around)) continue;
    const n = euroAmounts(text.slice(m.index, m.index + 180))[0];
    if (n != null) return n;
  }
  return null;
}

function firstPrice(...vals) {
  for (const v of vals) {
    const n = toPrice(v);
    if (n != null) return n;
  }
  return null;
}

function flattenPriceData(data) {
  if (!data || typeof data !== "object") return {};
  const nested = [data.car, data.auction, data.prices, data.pricing].filter((x) => x && typeof x === "object" && !Array.isArray(x));
  return nested.length ? Object.assign({}, data, ...nested) : data;
}

export function ecarstradeCardSlice(html, index) {
  const text = String(html ?? "");
  const before = text.slice(0, Math.max(0, index)).toLowerCase();
  const marker = Math.max(before.lastIndexOf("car-item"), before.lastIndexOf("data-itemid"));
  let start = text.lastIndexOf("<div", index);
  if (marker >= 0) {
    const div = text.lastIndexOf("<div", marker + 1);
    if (div >= 0) start = div;
  }
  return text.slice(Math.max(0, start), index + 16_000);
}

export function extractEcarstradeRelayItem(html, data = {}) {
  const s = String(html ?? "");
  const d = flattenPriceData(data);
  const id = String(d.id || d.car_id || "").replace(/\D/g, "") || /data-itemId=["'](\d+)["']/i.exec(s)?.[1] || "";
  if (!id) return null;
  const title =
    stripTags(/<div class="item-title[\s\S]*?<span>([\s\S]*?)<\/span>/i.exec(s)?.[1] ?? "") ||
    stripTags(/aria-label="Share\s+([^"]+)"/i.exec(s)?.[1] ?? "") ||
    stripTags(/<div class="small text-muted">\s*#\d+\s*-\s*([^<]+)/i.exec(s)?.[1] ?? "") ||
    stripTags(/alt=["']([^"']+)["']/i.exec(s)?.[1] ?? "") ||
    `#${id}`;
    const manufacturer = title.replace(/^#\d+\s*-?\s*/i, "").split(/\s+/).find((w) => /[a-z]/i.test(w)) || "";
  const signedOut = /Sign in to (?:buy|see)/i.test(s);
  const bidNoBids = !signedOut && isEcarstradeBidNoBidsHtml(s);
  const auctionTypeEarly = String(
    d.auction_type || /data-auction-type=["']([^"']+)["']/i.exec(s)?.[1] || inferAuctionTypeFromButtons(s) || "",
  ).toLowerCase();
  const calcBidIsBuyNow = auctionTypeEarly !== "bid" && auctionTypeEarly !== "open";
  const buyNowFromHtml = signedOut
    ? null
    : buyNowFromFixButtons(s) ??
      buyNowFromBuyOrOfferHref(s) ??
      buyNowFromHeadLabel(s) ??
      (bidNoBids || !calcBidIsBuyNow ? null : buyNowFromCalcBid(s)) ??
      (bidNoBids ? null : buyNowLabeledAmount(s)) ??
      (bidNoBids ? null : amountInClass(s, "car-price__button"));
  /** Live current bid is websocket; HTML also has the visible value when it exists. */
  const currentFromHtml = signedOut
    ? null
    : amountAfter(s, /Current bid|Highest bid|Pašreizēj|Aktuālais solījums|Max\.?\s*bid|(?<!Aplēses )Solījums/i) ??
      amountInClass(s, "car-price__current-bid__value") ??
      amountInClass(s, "car-price__bid-value");
  const buyNow = firstPrice(
    d.buy_now,
    d.buyNow,
    d.buy_now_price,
    d.buyNowPrice,
    d.fixed_price,
    d.fixedPrice,
    d.fix_price,
    buyNowFromHtml,
  );
  const current = firstPrice(d.current_bid, d.currentBid, d.highest_bid, d.highestBid, d.max_bid, d.maxBid, currentFromHtml);
  const estimate =
    firstPrice(
      d.estimate_price,
      d.estimatePrice,
      d.estimated_price,
      d.estimatedPrice,
      d.price_estimate,
      d.priceEstimate,
      d.appraisal_price,
      d.suggested_price,
    ) ?? (signedOut ? null : estimateFromHtml(s, bidNoBids));
  const total =
    firstPrice(d.total_price, d.totalPrice, d.price_total, d.priceTotal) ?? (signedOut ? null : totalFromHtml(s));
  const start = firstPrice(d.start_price, d.startPrice, d.min_bid);
  const auctionType = auctionTypeEarly;
  let priceCurrent = current;
  let priceBuyNow = buyNow;
  const priceEstimate = estimate ?? null;
  const priceTotal = total ?? null;
  if (auctionType === "stock" || auctionType === "fix") {
    priceCurrent = null;
    priceBuyNow = buyNow ?? current;
  } else if (auctionType === "bid" || auctionType === "blind") {
    const n = priceCurrent;
    if (n != null && n <= 1000 && priceBuyNow == null) priceCurrent = null;
  } else if (auctionType === "bid_or_fix" && buyNow != null && current === buyNow) {
    priceCurrent = null;
  }
  const flag = /\/images\/flags\/h\d+\/([a-z]{2})\.png/i.exec(s)?.[1] || "";
  const firstReg = stripTags(/data-original-title="First registration date"[\s\S]*?<div class="feature-value">([\s\S]*?)<\/div>/i.exec(s)?.[1] ?? "");
  const kmRaw = stripTags(/data-original-title="Mileage"[\s\S]*?<div class="feature-value">([\s\S]*?)<\/div>/i.exec(s)?.[1] ?? "");
  const km = (() => {
    const m = kmRaw.replace(/\u00a0/g, " ").match(/([\d.\s]+)\s*(?:km|км)/i);
    if (!m) return null;
    const n = Number.parseInt(m[1].replace(/[.\s]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  })();
  return makeItem("ecarstrade", {
    externalId: id,
    detailUrl: ecarstradeRelayDetailUrl(id),
    title,
    manufacturer,
    year: firstReg.match(/((?:19|20)\d{2})/)?.[1] || "",
    firstRegistration: firstReg,
    mileageKm: km,
    fuel: stripTags(/data-original-title="Fuel"[^>]*>([\s\S]*?)<\/span>/i.exec(s)?.[1] ?? ""),
    transmission: stripTags(/data-original-title="Gearbox"[\s\S]*?<div class="feature-value">([\s\S]*?)<\/div>/i.exec(s)?.[1] ?? ""),
    countryCode: flag.toUpperCase(),
    location: stripTags(/<span>\s*(Belgium|The Netherlands|Netherlands|Luxembourg|Germany)\s*<\/span>/i.exec(s)?.[1] ?? ""),
    imageUrl: /(?:data-src|src)=["']([^"']*(?:carsphotos|thumbnails|photo_)[^"']*)["']/i.exec(s)?.[1] || "",
    priceStart: start,
    priceCurrent,
    priceBuyNow,
    priceEstimate,
    priceTotal,
    auctionId: String(d.auction_id || /auction(\d+)/i.exec(s)?.[1] || ""),
    auctionStage: auctionType.toUpperCase(),
  });
}

export function extractEcarstradeRelayItems(html) {
  const text = String(html ?? "");
  const byId = new Map();
  const re = /data-itemId=["'](\d+)["']/gi;
  let m;
  while ((m = re.exec(text))) {
    const id = m[1];
    if (!id || byId.has(id)) continue;
    const item = extractEcarstradeRelayItem(ecarstradeCardSlice(text, m.index), { id });
    if (item) byId.set(id, item);
  }
  return [...byId.values()];
}

export function itemsFromEcarstradeApiBody(raw) {
  const byId = new Map();
  for (const obj of splitConcatenatedJsonObjects(raw)) {
    const data = obj.data && typeof obj.data === "object" && !Array.isArray(obj.data) ? obj.data : {};
    if (!data.id && obj.car_id) data.id = obj.car_id;
    if (!data.auction_type && obj.auction_type) data.auction_type = obj.auction_type;
    let html = "";
    if (typeof obj.result === "string" && obj.result) {
      try {
        html = Buffer.from(obj.result, "base64").toString("utf8");
      } catch {
        html = "";
      }
    }
    const item = extractEcarstradeRelayItem(html, data);
    if (item && !byId.has(item.externalId)) byId.set(item.externalId, item);
  }
  return [...byId.values()];
}

export function mergeEcarstradeRelayItems(into, extra) {
  const map = new Map((into ?? []).map((it) => [it.externalId, it]));
  for (const it of extra ?? []) {
    if (!it?.externalId) continue;
    const prev = map.get(it.externalId);
    if (!prev) {
      map.set(it.externalId, it);
      continue;
    }
    map.set(it.externalId, {
      ...prev,
      ...it,
      title: it.title && it.title !== `#${it.externalId}` ? it.title : prev.title,
      priceBuyNow: it.priceBuyNow ?? prev.priceBuyNow,
      priceCurrent: it.priceCurrent ?? prev.priceCurrent,
      priceStart: it.priceStart ?? prev.priceStart,
      priceEstimate: it.priceEstimate ?? prev.priceEstimate,
      priceTotal: it.priceTotal ?? prev.priceTotal,
    });
  }
  return [...map.values()];
}

function encodeCookieValue(raw) {
  return encodeURIComponent(raw).replace(/%2E/gi, ".");
}

function cookieHasAuth(cookies) {
  return (cookies ?? []).some((c) => c.name === "eCT/user" && c.value && !/^deleted$/i.test(c.value));
}

async function persistProfileCookies(page) {
  const context = page.context();
  const cookies = await context.cookies().catch(() => []);
  const expires = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC;
  const next = cookies
    .filter((c) => /ecarstrade\.com$/i.test(String(c.domain || "")))
    .filter((c) => c.value && !/^deleted$/i.test(String(c.value)))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || "ecarstrade.com",
      path: c.path || "/",
      expires: c.expires && c.expires > 0 ? c.expires : expires,
      httpOnly: Boolean(c.httpOnly),
      secure: true,
      sameSite: c.sameSite || "Lax",
    }));
  if (!cookieHasAuth(next) || !next.length) return;
  await context.addCookies(next).catch(() => undefined);
}

async function persistAuthTokens(page, access, refresh) {
  const expires = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC;
  const cookies = [
    {
      name: "eCT/user",
      value: encodeCookieValue(access),
      domain: "ecarstrade.com",
      path: "/",
      expires,
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ];
  if (refresh) {
    cookies.push({
      name: "eCT/refresh-token",
      value: encodeCookieValue(refresh),
      domain: "ecarstrade.com",
      path: "/",
      expires,
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    });
  }
  await page.context().addCookies(cookies).catch(() => undefined);
  await page
    .evaluate(
      ({ access: a, refresh: r, maxAge }) => {
        const enc = encodeURIComponent(a).replace(/%2E/gi, ".");
        document.cookie = `eCT/user=${enc}; path=/; max-age=${maxAge}; secure; samesite=lax`;
        if (r) {
          const encR = encodeURIComponent(r).replace(/%2E/gi, ".");
          document.cookie = `eCT/refresh-token=${encR}; path=/; max-age=${maxAge}; secure; samesite=lax`;
        }
        try {
          localStorage.setItem("eCT/user", a);
          if (r) localStorage.setItem("eCT/refresh-token", r);
        } catch {
          /* privātais režīms */
        }
      },
      { access, refresh, maxAge: COOKIE_MAX_AGE_SEC },
    )
    .catch(() => undefined);
  await persistProfileCookies(page);
}

async function tokensFromStorage(page) {
  return page
    .evaluate(() => {
      try {
        return {
          access: localStorage.getItem("eCT/user") || localStorage.getItem("accessToken") || "",
          refresh: localStorage.getItem("eCT/refresh-token") || localStorage.getItem("refreshToken") || "",
        };
      } catch {
        return { access: "", refresh: "" };
      }
    })
    .catch(() => ({ access: "", refresh: "" }));
}

/** localStorage paliek profilā, bet sesijas sīkdatne pazūd, kad Chrome aizveras. */
async function restoreAuthFromStorage(page) {
  const cookies = await page.context().cookies("https://ecarstrade.com").catch(() => []);
  if (cookieHasAuth(cookies)) {
    await persistProfileCookies(page);
    return true;
  }
  const tokens = await tokensFromStorage(page);
  if (!tokens.access) return false;
  await persistAuthTokens(page, tokens.access, tokens.refresh);
  return true;
}

export async function persistSession(page) {
  await restoreAuthFromStorage(page);
}

async function isLoggedIn(page) {
  if (await restoreAuthFromStorage(page)) return true;
  const text = await pageText(page, 12_000);
  if (/sign in to buy/i.test(text) && !LOGGED_IN_RE.test(text)) return false;
  return LOGGED_IN_RE.test(text);
}

async function postLogin(page, username, password) {
  return page.evaluate(
    async ({ origin, authPath, username: user, password: pass }) => {
      const res = await fetch(`${origin}${authPath}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          origin,
          referer: `${origin}/search`,
        },
        body: JSON.stringify({ username: user, password: pass }),
        credentials: "include",
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false, status: res.status, note: "not_json" };
      }
      const data = json && typeof json === "object" && json.data && typeof json.data === "object" ? json.data : json;
      const access = data && (data.accessToken || data.access_token);
      if (!access) return { ok: false, status: res.status, note: "no_token" };
      return {
        ok: true,
        status: res.status,
        access,
        refresh: data.refreshToken || data.refresh_token || "",
      };
    },
    { origin: ORIGIN, authPath: AUTH_PATH, username, password },
  );
}

async function login(page) {
  const username = process.env.ECARSTRADE_USER;
  const password = process.env.ECARSTRADE_PASS;
  if (!username || !password) {
    return { ok: false, status: "login_required", note: "eCarsTrade: nav lietotāja / paroles env." };
  }
  try {
    await page.goto(`${ORIGIN}${WARMUP_PATH}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(400, 900);
    await persistProfileCookies(page);
    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge) {
      return { ok: false, status: "login_required", note: `eCarsTrade: login lapā ${challenge}; jāielogojas manuāli.` };
    }
    if (await isLoggedIn(page)) return { ok: true, status: "ok", note: "session_ok" };
    let result = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      result = await postLogin(page, username, password);
      if (result?.ok) break;
      if (!LOGIN_RETRY_STATUSES.has(Number(result?.status)) || attempt === 3) break;
      await randomPause(1_800, 3_200);
    }
    if (!result?.ok) {
      return {
        ok: false,
        status: result?.status === 401 || result?.status === 403 ? "login_required" : "error",
        note: `eCarsTrade: login ${result?.note || "neizdevās"} (HTTP ${result?.status ?? "?"}).`,
      };
    }
    await persistAuthTokens(page, result.access, result.refresh);
    await page.goto(`${ORIGIN}/search`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(800, 1_600);
    await persistProfileCookies(page);
    if (await isLoggedIn(page)) return { ok: true, status: "ok", note: "auto_login_ok" };
    return { ok: false, status: "login_required", note: "eCarsTrade: pēc login sesija joprojām nav aktīva." };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      note: `eCarsTrade: login kļūda ${e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma"}`,
    };
  }
}

async function waitForCards(page) {
  await page.waitForSelector("[data-itemId]", { timeout: 12_000 }).catch(() => undefined);
  await randomPause(400, 900);
}

async function fetchApiInPage(page, apiUrl) {
  return page
    .evaluate(async (url) => {
      const token = (() => {
        try {
          const ls = localStorage.getItem("eCT/user") || localStorage.getItem("accessToken") || "";
          if (ls) return ls;
        } catch {
          /* privātais režīms */
        }
        const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)eCT\/user=([^;]+)/) : null;
        return m ? decodeURIComponent(m[1]) : "";
      })();
      const headers = {
        accept: "application/json,text/plain,*/*",
        "x-requested-with": "XMLHttpRequest",
      };
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(url, { credentials: "include", headers });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 2_000_000) };
    }, apiUrl)
    .catch(() => ({ status: 0, text: "" }));
}

async function fetchSource(page, sourceUrl, { maxPages, log, needPriceIds }) {
  try {
    const started = Date.now();
    await restoreAuthFromStorage(page);
    if (!/ecarstrade\.com/i.test(page.url())) {
      await page.goto(`${ORIGIN}${WARMUP_PATH}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await randomPause(400, 900);
      await restoreAuthFromStorage(page);
    }
    const searchPages = [];
    const detailPages = [];
    let items = [];
    let pageCount = 1;
    const missingIds = new Set();
    let usedApi = false;
    const extraNeedIds = Array.isArray(needPriceIds) ? needPriceIds : [];
    const detailMax = Math.max(1, Number(process.env.LISTINGS_ET_DETAIL_PRICE_MAX || 80));
    const detailBudgetMs = Math.max(8_000, Number(process.env.LISTINGS_ET_DETAIL_BUDGET_MS || 120_000));
    for (let p = 1; p <= maxPages; p += 1) {
      if (p > 1) {
        if (p > pageCount) break;
        await randomPause(1_200, 2_600);
      }
      const start = p <= 1 ? 0 : (p - 1) * 20;
      const api = await fetchApiInPage(page, ecarstradeRelayApiUrl(sourceUrl, start));
      if (isEcarstradeFutureApiTrulyEmpty(api)) {
        if (p === 1 && items.length === 0) {
          const loggedIn = await isLoggedIn(page);
          log(`ecarstrade future_api ${api.status} tukšs, ok 0 (truly empty)`);
          return {
            status: "ok",
            note: "ok 0 (truly empty)",
            items: [],
            raw: { kind: "ecarstrade-html", searchPages: [], detailPages: [], loggedIn },
            pagesFetched: 1,
            pageCount: 1,
          };
        }
        pageCount = Math.max(1, p - 1);
        break;
      }
      let html = htmlFromEcarstradeApiBody(api.text);
      items = mergeEcarstradeRelayItems(items, itemsFromEcarstradeApiBody(api.text));
      if (collectEcarstradeCardIds(html).length) {
        usedApi = true;
      } else {
        const resp = await page.goto(ecarstradeRelaySearchPageUrl(sourceUrl, p), {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        const status = resp?.status() ?? 0;
        if (status === 403 || status === 429) return fail("blocked", `eCarsTrade HTTP ${status}.`);
        if (status === 401) return fail("login_required", "eCarsTrade HTTP 401.");
        const challenge = await hasCaptchaOrChallenge(page);
        if (challenge) return fail("blocked", `eCarsTrade rāda ${challenge}.`);
        await waitForCards(page);
        const pageHtml = await page.content();
        html = pageHtml;
      }
      items = mergeEcarstradeRelayItems(items, extractEcarstradeRelayItems(html));
      searchPages.push(html.slice(0, 1_500_000));
      const ids = collectEcarstradeCardIds(html);
      for (const id of collectIdsNeedingPrice(items, html, p === 1 ? extraNeedIds : [])) {
        missingIds.add(id);
      }
      if (ids.length === 0) {
        pageCount = p;
        break;
      }
      if (ids.length >= 20) pageCount = Math.max(pageCount, p + 1);
      else pageCount = p;
    }
    const queued = [...missingIds].filter((id) => {
      const it = items.find((row) => row.externalId === id);
      return !it || ecarstradeItemNeedsPrice(it);
    });
    let i = 0;
    for (const id of queued) {
      if (i >= detailMax) break;
      if (Date.now() - started > detailBudgetMs) {
        log(`ecarstrade detail budget ${detailBudgetMs}ms, enriched ${i}/${queued.length}`);
        break;
      }
      i += 1;
      await randomPause(1_000, 2_200);
      const url = ecarstradeRelayDetailUrl(id);
      if (!url) continue;
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const status = resp?.status() ?? 0;
      if (status === 403 || status === 429) break;
      const challenge = await hasCaptchaOrChallenge(page);
      if (challenge) break;
      await page.waitForSelector("body", { timeout: 8_000 }).catch(() => undefined);
      const detailHtml = (await page.content()).slice(0, 800_000);
      detailPages.push({ id, html: detailHtml });
      const fromDetail = extractEcarstradeRelayItem(detailHtml, { id });
      items = mergeEcarstradeRelayItems(items, fromDetail ? [fromDetail] : extractEcarstradeRelayItems(detailHtml));
    }
    const loggedIn = await isLoggedIn(page);
    if (loggedIn) await persistProfileCookies(page);
    const cardCount = searchPages.reduce((n, html) => n + collectEcarstradeCardIds(html).length, 0);
    const stillMissing = items.filter(ecarstradeItemNeedsPrice).length;
    log(
      `ecarstrade ${searchPages.length} meklēšanas, ${detailPages.length} detaļas (trūka ${queued.length}), kartītes=${cardCount}, auto=${items.length}, bezCenas=${stillMissing}, api=${usedApi}, loggedIn=${loggedIn}`,
    );
    const note = items.length
      ? `eCarsTrade ${items.length} auto no releja Chrome${usedApi ? " (future_api pārlūkā)" : " (/search)"}.`
      : loggedIn
        ? cardCount
          ? `eCarsTrade kartītes=${cardCount}, bet auto ierakstus neizdevās izvilkt.`
          : "eCarsTrade relejs ielogots, bet /search nedeva kartītes."
        : "eCarsTrade lasīts bez login (publiskās kartītes).";
    return {
      status: "ok",
      note,
      items,
      raw: { kind: "ecarstrade-html", searchPages, detailPages, loggedIn },
      pagesFetched: searchPages.length,
      pageCount,
    };
  } catch (e) {
    return fail("error", e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda");
  }
}

function fail(status, note) {
  return { status, note, items: [], raw: null, pagesFetched: 0, pageCount: 0 };
}
