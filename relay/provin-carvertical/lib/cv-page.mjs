/**
 * CarVertical relejs: lapu un atbilžu atpazīšana bez pārlūka (testējams).
 *
 * Pārbaudīts dzīvi 23.11.2026 (bez pirkuma): /lv/auth -> e-pasts + parole -> /lv/auth/code
 * ("Tavs pierakstīšanās kods ir nosūtīts", lauks name=code, 6 rakstzīmes, 15 min). Pieteikšanās vienmēr prasa
 * e-pasta kodu (CarVertical `requiresLoginCode`), tāpēc relejs to nekad neapiet - gaida Nila ievadītu kodu.
 * Hetzner IP ir Somijā: lapa piedāvā "Palikt valstī: Latvija" (data-testid=stayInCurrentMarket).
 *
 * Konta dati nāk no CarVertical pašas lapas pieprasījumiem uz api.carvertical.net (relejs tos tikai nolasa):
 *   GET /user/quotas?productId=N  -> { quotas: { [productId]: kredīti } }
 *   GET /reports?productId=N&page=&per_page= -> { results: [{ id, vin, reportStatus (10/20/30), createdAt, finishedAt, expiresAt }], count }
 *   GET /reports/{id}/pdf/full?locale=lv -> { pdfUrl } (404 = PDF vēl top), fails no www.carvertical.com/pdf/<ceļš>
 */

export const CV_ORIGIN = "https://www.carvertical.com";
export const CV_API = "https://api.carvertical.net";
export const CV_AUTH_URL = `${CV_ORIGIN}/lv/auth`;
export const CV_REPORTS_URL = `${CV_ORIGIN}/lv/user/reports`;

/** CarVertical atskaites statusi (lapas kods: Created=10, Pending=20, Finished=30). */
export const CV_REPORT_STATUS = { created: 10, pending: 20, finished: 30 };

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
}

export function isValidVin(raw) {
  return VIN_RE.test(normalizeVin(raw));
}

/** Galvenā loga navigācija tikai uz carvertical.com (resursi, reCAPTCHA un API iet kā parasti). */
export function isAllowedHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "carvertical.com" || h === "www.carvertical.com";
}

/**
 * Ceļi, uz kuriem relejs NEKAD neiet: maksājums ar karti / paketes izvēle / abonements.
 * Kredītu pirkums iet caur "Izmantot atskaiti" saiti uz atskaites lapu, nevis caur checkout.
 */
export function isForbiddenPath(pathname) {
  const p = String(pathname ?? "").toLowerCase();
  return /\/(checkout|checkout-plain|payment|billing|subscription|pricing)(\/|$)/.test(p) || /\/precheck\/pricing(\/|$)/.test(p);
}

/** E-pasta pieteikšanās koda formāts (6 burti/cipari). */
export function normalizeLoginCode(raw) {
  const c = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : "";
}

/**
 * Lapas stāvoklis pēc URL un teksta.
 * @param {{url:string, text?:string, hasCodeInput?:boolean, hasPasswordInput?:boolean, captchaChallenge?:boolean}} s
 */
export function classifyAuthPage(s) {
  let pathname = "";
  try {
    pathname = new URL(s.url).pathname.toLowerCase();
  } catch {
    pathname = "";
  }
  const text = String(s.text ?? "");
  if (s.captchaChallenge) return "captcha";
  if (/\/auth\/code(\/|$)/.test(pathname) || s.hasCodeInput) return "code";
  if (/\/auth(\/|$)|\/login(\/|$)/.test(pathname) || s.hasPasswordInput) {
    if (/nepareiz|incorrect|invalid (e-?mail|password)|wrong password/i.test(text)) return "bad_credentials";
    return "login_form";
  }
  if (/\/user(\/|$)/.test(pathname)) return "logged_in";
  return "unknown";
}

/** Kredītu atlikums no `/user/quotas` atbildes. `null`, ja atbilde nav atpazīta. */
export function parseQuotas(json, productId) {
  if (!json || typeof json !== "object") return null;
  const quotas = json.quotas;
  if (!quotas || typeof quotas !== "object") return null;
  const pick = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null);
  if (productId != null && Object.prototype.hasOwnProperty.call(quotas, String(productId))) {
    return pick(quotas[String(productId)]);
  }
  const values = Object.values(quotas).map(pick).filter((v) => v != null);
  return values.length === 1 ? values[0] : null;
}

/** Atlikuma rezerve no lapas teksta ("Pieejamās atskaites: 5", "5 kredīti", "Available reports 5"). */
export function parseCreditsFromText(text) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const patterns = [
    /pieejam[aā]s atskaites[:\s]*(\d{1,4})/i,
    /available reports[:\s]*(\d{1,4})/i,
    /(\d{1,4})\s*(?:kred[iī]t[sia]?|credits?)\b/i,
    /(?:kred[iī]ti|credits)[:\s]*(\d{1,4})/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

/** `/reports?...` atbilde -> atskaišu saraksts (bez personas datiem: tikai id, VIN, statuss, datumi). */
export function parseReportsList(json) {
  const rows = Array.isArray(json?.results) ? json.results : Array.isArray(json) ? json : [];
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const id = typeof r.id === "string" || typeof r.id === "number" ? String(r.id).slice(0, 80) : "";
    const vin = normalizeVin(r.vin ?? r.identifier ?? "");
    if (!id || !VIN_RE.test(vin)) continue;
    const status = Number(r.reportStatus);
    out.push({
      id,
      vin,
      status: Number.isFinite(status) ? status : 0,
      createdAt: typeof r.createdAt === "string" ? r.createdAt.slice(0, 40) : "",
      finishedAt: typeof r.finishedAt === "string" ? r.finishedAt.slice(0, 40) : "",
      expiresAt: typeof r.expiresAt === "string" ? r.expiresAt.slice(0, 40) : "",
    });
  }
  return out;
}

function isExpired(row, now) {
  if (!row.expiresAt) return false;
  const t = Date.parse(row.expiresAt);
  return Number.isFinite(t) && t < now.getTime();
}

/** Jaunākā šī VIN atskaite (gatava vai vēl top). Beigusies (`expiresAt` pagātnē) netiek ņemta. */
export function findReportForVin(list, vin, now = new Date()) {
  const v = normalizeVin(vin);
  const hits = (list ?? []).filter((r) => r.vin === v && !isExpired(r, now));
  if (hits.length === 0) return null;
  const finished = hits.filter((r) => r.status === CV_REPORT_STATUS.finished);
  const pool = finished.length > 0 ? finished : hits;
  return [...pool].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0];
}

/**
 * Pirkuma lēmums (pirms jebkura klikšķa):
 *  - šim VIN jau ir atskaite kontā -> lejupielādē, NEPĒRK;
 *  - relejs šo VIN jau pirka (reģistrs) -> NEPĒRK otrreiz, gaida atskaiti sarakstā;
 *  - atlikums nav zināms vai < 1 -> NEPĒRK.
 */
export function decidePurchase({ existing, alreadyPurchased, credits }) {
  if (existing) return { action: "download", reason: "existing_report" };
  if (alreadyPurchased) return { action: "wait_existing", reason: "already_purchased" };
  if (typeof credits !== "number" || !Number.isFinite(credits)) return { action: "stop", reason: "balance_unknown" };
  if (credits < 1) return { action: "stop", reason: "insufficient_credits" };
  return { action: "purchase", reason: "ok" };
}

/**
 * Kredītu saite precheck lapā ("Izmantot atskaiti"): ved uz atskaites lapu ar `vin=` / `encryptedVin=`,
 * nekad uz checkout / pricing. Atgriež drošo URL vai "".
 */
export function pickCreditUseHref(links, vin) {
  const v = normalizeVin(vin);
  for (const l of links ?? []) {
    let u;
    try {
      u = new URL(String(l.href ?? ""), CV_ORIGIN);
    } catch {
      continue;
    }
    if (!isAllowedHost(u.hostname)) continue;
    if (isForbiddenPath(u.pathname) || /\/precheck(\/|$)/i.test(u.pathname)) continue;
    const params = u.searchParams;
    const hasVin = normalizeVin(params.get("vin") ?? "") === v || Boolean(params.get("encryptedVin"));
    if (!hasVin) continue;
    if (l.analytics && l.analytics !== "useOneReport") continue;
    return u.toString();
  }
  return "";
}

export function isPdfBase64(b64) {
  if (typeof b64 !== "string" || b64.length < 8) return false;
  try {
    return Buffer.from(b64.slice(0, 12), "base64").subarray(0, 5).toString("latin1") === "%PDF-";
  } catch {
    return false;
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Žurnālam / debug: noslēpumi, e-pasti, Bearer tokeni -> ***. */
export function redact(text, secrets = []) {
  let out = String(text ?? "");
  for (const s of secrets) {
    if (s && String(s).length >= 4) out = out.split(String(s)).join("***");
  }
  return out.replace(EMAIL_RE, "***@***").replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, "Bearer ***");
}
