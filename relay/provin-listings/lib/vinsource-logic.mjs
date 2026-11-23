/**
 * VIN SCAN avoti, kurus relejs nolasa ar Chrome pēc VIN (nevis pēc gatava URL):
 * bid.cars (meklēšanas API -> lota lapa) un CARFAX.eu (bezmaksas pieejamības pārbaude).
 * Te tikai tīra loģika (validācija, kešs, atbilžu nolasīšana) - Chrome daļa ir vinsource-page.mjs.
 */

export const VINSOURCE_IDS = ["bid_cars", "carfax_eu"];

/** Viss darbs Chrome (palaišana + lapas + gaidīšana) iekļaujas šajā laikā. */
export const VINSOURCE_TIMEOUT_MS = 40_000;
/** Kešs: tas pats VIN un avots diennakts laikā Chrome neatver vēlreiz. */
export const VINSOURCE_CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const HTML_LIMIT = 900_000;

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function validVinSourceRequest(body) {
  const source = String(body?.source ?? "").trim();
  const vin = String(body?.vin ?? "").trim().toUpperCase();
  if (!VINSOURCE_IDS.includes(source)) return { ok: false, error: "nezināms avots" };
  if (!VIN_RE.test(vin)) return { ok: false, error: "nederīgs VIN" };
  return { ok: true, source, vin };
}

/** Rindas atslēga: visi vinsource darbi dala vienu Chrome vietu (viens Chrome vienlaikus). */
export function vinSourceLaneKey(source, vin) {
  return `https://vinsource.relay/${source}/${vin}`;
}

export function bidCarsSearchApiUrl(vin) {
  return `https://bid.cars/app/search/en/vin-lot/${encodeURIComponent(vin)}/true`;
}

/** Lota URL tikai no bid.cars, ar /lot/ ceļu un tieši šo VIN (citādi tā nav šī auto lapa). */
export function validBidCarsLotUrl(raw, vin) {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    if (host !== "bid.cars" && host !== "www.bid.cars") return "";
    if (!/^\/[a-z]{2}\/lot\/[0-9]-[0-9]{5,12}\//i.test(u.pathname)) return "";
    if (!u.pathname.toUpperCase().includes(String(vin).toUpperCase())) return "";
    return u.toString();
  } catch {
    return "";
  }
}

/**
 * bid.cars `/app/search/{lang}/vin-lot/{VIN}/true` atbilde:
 * `{"results":1,"url":".../lot/..."}` vai `{"results":0,"url":".../search/archived/results?..."}`.
 */
export function readBidCarsSearch(text, vin) {
  let body = null;
  try {
    body = JSON.parse(String(text ?? ""));
  } catch {
    return { kind: "error", note: "bid.cars meklēšana neatdeva JSON" };
  }
  if (!body || typeof body !== "object") return { kind: "error", note: "bid.cars meklēšana neatdeva JSON" };
  const results = Number(body.results);
  if (results === 0) return { kind: "none", results: 0 };
  const lotUrl = validBidCarsLotUrl(body.url, vin);
  if (results > 0 && lotUrl) return { kind: "lot", results, lotUrl };
  return { kind: "error", note: "bid.cars meklēšana: nav lota adreses" };
}

/**
 * CARFAX.eu `web-backend.carfax.eu/api/v1/record-check/{VIN}`:
 * 200 + recordCheck = dati ir; 422/404 = šim VIN ierakstu nav. Citi kodi = kļūda.
 */
export function readCarfaxRecordCheck(status, text) {
  let body = null;
  try {
    body = JSON.parse(String(text ?? ""));
  } catch {
    body = null;
  }
  if (status === 200 && body && typeof body === "object" && body.recordCheck) return { kind: "found", json: body };
  if (status === 404 || status === 422) return { kind: "none", json: body && typeof body === "object" ? body : null };
  return { kind: "error", note: `CARFAX.eu atbildēja HTTP ${status || 0}` };
}

export function carfaxRecordCheckMatches(url, vin) {
  try {
    const u = new URL(String(url ?? ""));
    if (u.hostname.toLowerCase() !== "web-backend.carfax.eu") return false;
    return u.pathname.toUpperCase().endsWith(`/RECORD-CHECK/${String(vin).toUpperCase()}`);
  } catch {
    return false;
  }
}

export function clipHtml(html) {
  return String(html ?? "").slice(0, HTML_LIMIT);
}

/** 24 h kešs tikai galīgiem rezultātiem (found/none). Kļūdas un bloķējumus nekešo. */
export function createVinSourceCache(opts = {}) {
  const ttlMs = Number.isFinite(opts.ttlMs) ? opts.ttlMs : VINSOURCE_CACHE_MS;
  const max = Number.isFinite(opts.max) ? opts.max : CACHE_MAX;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  /** @type {Map<string, { at: number, value: any }>} */
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (now() - hit.at > ttlMs) {
        map.delete(key);
        return null;
      }
      return { ...hit.value, cached: true, cachedAt: new Date(hit.at).toISOString() };
    },
    set(key, value) {
      if (!value || (value.kind !== "found" && value.kind !== "none")) return;
      map.delete(key);
      map.set(key, { at: now(), value });
      while (map.size > max) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
    },
    get size() {
      return map.size;
    },
  };
}
