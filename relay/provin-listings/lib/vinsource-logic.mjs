/**
 * VIN SCAN avoti, kurus relejs nolasa ar Chrome pēc VIN (nevis pēc gatava URL):
 * bid.cars (meklēšanas API -> lota lapa), CARFAX.eu (bezmaksas pieejamības pārbaude) un
 * kfzgutachten.at (Austrijas §57a apskašu bezmaksas saraksts pēc VIN + 1. reģ. datuma; atzinumus nepērk).
 * Te tikai tīra loģika (validācija, kešs, atbilžu nolasīšana) - Chrome daļa ir vinsource-page.mjs.
 */

export const VINSOURCE_IDS = ["bid_cars", "carfax_eu", "kfz_at"];

/** Viss darbs Chrome (palaišana + lapas + gaidīšana) iekļaujas šajā laikā. */
export const VINSOURCE_TIMEOUT_MS = 40_000;
/** Kešs: tas pats VIN un avots diennakts laikā Chrome neatver vēlreiz. */
export const VINSOURCE_CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const HTML_LIMIT = 900_000;

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/** DD.MM.YYYY, ja datums ir reāls kalendāra datums (kfzgutachten.at Erstzulassungsdatum); citādi "". */
export function kfzExactDate(raw) {
  const t = String(raw ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(t);
  const dot = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t);
  let d;
  let m;
  let y;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dot) [d, m, y] = [Number(dot[1]), Number(dot[2]), Number(dot[3])];
  else return "";
  if (y < 1950 || y > 2100) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  if (dt.getTime() > Date.now() + 24 * 60 * 60 * 1000) return "";
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

export function validVinSourceRequest(body) {
  const source = String(body?.source ?? "").trim();
  const vin = String(body?.vin ?? "").trim().toUpperCase();
  if (!VINSOURCE_IDS.includes(source)) return { ok: false, error: "nezināms avots" };
  if (!VIN_RE.test(vin)) return { ok: false, error: "nederīgs VIN" };
  if (source === "kfz_at") {
    // kfzgutachten.at bez precīza 1. reģ. datuma nemeklē - datumu neizdomājam.
    const date = kfzExactDate(body?.date);
    if (!date) return { ok: false, error: "vajag precīzu 1. reģ. datumu (TT.MM.GGGG)" };
    return { ok: true, source, vin, date };
  }
  return { ok: true, source, vin };
}

/** Rindas atslēga: visi vinsource darbi dala vienu Chrome vietu (viens Chrome vienlaikus). kfz_at: + datums. */
export function vinSourceLaneKey(source, vin, date = "") {
  return `https://vinsource.relay/${source}/${vin}${date ? `/${date}` : ""}`;
}

/* ---------------- kfzgutachten.at ---------------- */

/** IP reputācija: ne vairāk kā 1 īsts vaicājums ik 2 min (Nila lēmums 26.11). */
export const KFZ_MIN_INTERVAL_MS = 2 * 60 * 1000;
/** Rinda: ne vairāk par tik gaidošiem vaicājumiem; vecāki par 6 h izkrīt. */
export const KFZ_QUEUE_MAX = 30;
export const KFZ_QUEUE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function kfzSearchResponseMatches(url, method) {
  try {
    const u = new URL(String(url ?? ""));
    const host = u.hostname.toLowerCase();
    if (host !== "kfzgutachten.at" && host !== "www.kfzgutachten.at") return false;
    return /^\/home\/search\/?$/i.test(u.pathname) && String(method ?? "POST").toUpperCase() === "POST";
  } catch {
    return false;
  }
}

function isoToDdMmYyyy(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? "").trim());
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return kfzExactDate(raw);
}

function cleanCell(v, max = 80) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Nobraukums, ja atbildē tāds lauks ir (sarakstā parasti nav - tad ""). */
function itemKm(item) {
  for (const [k, v] of Object.entries(item ?? {})) {
    if (!/mileage|kilomet|odometer|kmstand/i.test(k)) continue;
    const n = String(v ?? "").replace(/\D/g, "");
    if (n && n.length <= 7) return n;
  }
  return "";
}

/**
 * `POST /Home/Search` atbilde (lapas skripts: `result.Items[]`, `result.TotalItems`).
 * Rinda: { date: DD.MM.YYYY (Gutachtendatum), model, plate, vin, km? }. Tikai šī VIN rindas.
 * reCAPTCHA atteikums -> `captcha: true` (atdzišana, nekešo). Neskaidra atbilde -> kļūda (nekešo).
 */
export function readKfzSearch(status, text, vin) {
  const raw = String(text ?? "");
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (/recaptcha/i.test(raw) && !(body && Array.isArray(body.Items) && body.Items.length > 0)) {
    return { kind: "error", note: "kfzgutachten.at: reCAPTCHA noraidīja", captcha: true };
  }
  if (status !== 200) {
    return status === 400 || status === 403
      ? { kind: "error", note: `kfzgutachten.at: meklēšana noraidīta (HTTP ${status})`, captcha: true }
      : { kind: "error", note: `kfzgutachten.at atbildēja HTTP ${status || 0}` };
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.Items)) {
    return { kind: "error", note: "kfzgutachten.at: neskaidra atbilde (nav saraksta)" };
  }
  const want = String(vin ?? "").toUpperCase();
  const rows = [];
  const seen = new Set();
  for (const item of body.Items) {
    if (!item || typeof item !== "object") continue;
    const rowVin = cleanCell(item.VehicleIdentificationNumber, 20).replace(/\s/g, "").toUpperCase();
    if (want && rowVin && rowVin !== want) continue;
    const date = isoToDdMmYyyy(item.EvaluationDate);
    if (!date) continue;
    const plate = cleanCell(item.LicensePlate, 20);
    const key = `${date}|${plate.replace(/\s/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const km = itemKm(item);
    rows.push({
      date,
      model: cleanCell([item.VehicleModel, item.VehicleType].filter(Boolean).join(" ")),
      plate,
      vin: rowVin || want,
      ...(km ? { km } : {}),
    });
  }
  const dayMs = (d) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d);
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0;
  };
  rows.sort((a, b) => dayMs(a.date) - dayMs(b.date));
  if (rows.length === 0) return { kind: "none", rows: [] };
  return { kind: "found", rows: rows.slice(0, 60) };
}

/**
 * kfzgutachten.at plānotājs: ≥2 min starp īstiem vaicājumiem + rinda (FIFO, bez dublikātiem).
 * Tīra loģika - taimeri un Chrome ir server.mjs.
 */
export function createKfzScheduler(opts = {}) {
  const intervalMs = Number.isFinite(opts.intervalMs) ? opts.intervalMs : KFZ_MIN_INTERVAL_MS;
  const maxPending = Number.isFinite(opts.maxPending) ? opts.maxPending : KFZ_QUEUE_MAX;
  const maxAgeMs = Number.isFinite(opts.maxAgeMs) ? opts.maxAgeMs : KFZ_QUEUE_MAX_AGE_MS;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  let lastRunAt = 0;
  /** @type {Map<string, { vin: string, date: string, at: number }>} */
  const pending = new Map();
  const prune = () => {
    for (const [key, job] of pending) if (now() - job.at > maxAgeMs) pending.delete(key);
  };
  return {
    /** 0 - drīkst vaicāt tagad; citādi ms līdz nākamajam atļautajam vaicājumam. */
    waitMs() {
      return lastRunAt ? Math.max(0, lastRunAt + intervalMs - now()) : 0;
    },
    markRun() {
      lastRunAt = now();
    },
    /** Ieliek rindā (vai atstāj esošo vietu). Atgriež vietu rindā (1..n) vai 0, ja rinda pilna. */
    enqueue(key, vin, date) {
      prune();
      if (!pending.has(key)) {
        if (pending.size >= maxPending) return 0;
        pending.set(key, { vin, date, at: now() });
      }
      return [...pending.keys()].indexOf(key) + 1;
    },
    position(key) {
      prune();
      return [...pending.keys()].indexOf(key) + 1;
    },
    forget(key) {
      pending.delete(key);
    },
    /** Nākamais darbs, ja intervāls ir pagājis (ar `blockedMs` > 0 - neko nedod). */
    takeNext(blockedMs = 0) {
      prune();
      if (blockedMs > 0 || this.waitMs() > 0) return null;
      const first = pending.entries().next();
      if (first.done) return null;
      const [key, job] = first.value;
      pending.delete(key);
      return { key, ...job };
    },
    get size() {
      prune();
      return pending.size;
    },
  };
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

/** CARFAX.eu backend noraidīja reCAPTCHA v3 tokenu (zems vērtējums). */
export function isCarfaxCaptchaReject(status, text) {
  return status === 403 && /INVALID_CAPTCHA/.test(String(text ?? ""));
}

/**
 * Atdzišana pēc reCAPTCHA atteikuma. Mērījums 26.11: atkārtojot uzreiz (tajā pašā vai jaunā sesijā),
 * Google vērtējums šim IP krīt vēl zemāk un nākamās ~10+ min krīt VISI vaicājumi. Tāpēc pēc 403
 * relejs CARFAX.eu kādu laiku neatver (atgriež `blocked`, VIN SCAN paliek pārlūka josla),
 * ar katru nākamo atteikumu pauze dubultojas līdz maksimumam; pirmā veiksme atiestata.
 */
export const CARFAX_COOLDOWN_BASE_MS = 20 * 60 * 1000;
export const CARFAX_COOLDOWN_MAX_MS = 3 * 60 * 60 * 1000;
/** CARFAX ierakstu skaiti mainās lēni: found/none glabā 7 dienas (mazāk vaicājumu = mazāk captcha). */
export const CARFAX_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export function createCarfaxCooldown(opts = {}) {
  const base = Number.isFinite(opts.baseMs) ? opts.baseMs : CARFAX_COOLDOWN_BASE_MS;
  const max = Number.isFinite(opts.maxMs) ? opts.maxMs : CARFAX_COOLDOWN_MAX_MS;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  let strikes = 0;
  let until = 0;
  return {
    /** 0, ja drīkst vaicāt; citādi atlikušās ms. */
    remainingMs() {
      return Math.max(0, until - now());
    },
    untilIso() {
      return until > now() ? new Date(until).toISOString() : "";
    },
    record(out) {
      if (out && (out.kind === "found" || out.kind === "none")) {
        strikes = 0;
        until = 0;
        return;
      }
      if (out && out.captcha) {
        strikes += 1;
        until = now() + Math.min(max, base * 2 ** (strikes - 1));
      }
    },
    get strikes() {
      return strikes;
    },
  };
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
  /** Avotam savs derīgums (piem. carfax_eu 7 d); atslēga ir vinSourceLaneKey. */
  const ttlFor = (key) => {
    const src = String(key).split("/")[3] ?? "";
    const own = opts.ttlBySource?.[src];
    return Number.isFinite(own) ? own : ttlMs;
  };
  const max = Number.isFinite(opts.max) ? opts.max : CACHE_MAX;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  /** @type {Map<string, { at: number, value: any }>} */
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (now() - hit.at > ttlFor(key)) {
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
