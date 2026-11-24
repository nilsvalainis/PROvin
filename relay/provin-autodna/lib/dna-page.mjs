/**
 * AutoDNA relejs: lapu un atbilžu atpazīšana bez pārlūka (testējams).
 *
 * Pārbaudīts dzīvi 24.11.2026 no Hetzner (bez pieteikšanās un bez pirkuma):
 *   - www.autodna.lv sākumlapa un /ajax/* bez Cloudflare izaicinājuma; sīkdatņu logs (consentmanager, shadow DOM) -
 *     relejs spiež "Noraidīt visu" (a.cmpboxbtnno);
 *   - pieteikšanās: galvenes poga button.header-login -> forma #form-login (#form-login-email, #form-login-pass,
 *     noteikumu ķeksis #sidebar-login-checkbox caur label) -> POST /ajax/client_login -> {is_valid, errors, default_error};
 *     nepareizai parolei default_error "Nepareizs logins vai parole";
 *   - POST /ajax/client_is_login (vin=...) -> {client_email, client_id, report_bought, report_date, report_is_report,
 *     report_is_timeout}: vai ielogots un vai šim VIN atskaite jau nopirkta;
 *   - GET /ajax/get_client_credits -> {count, data:[{report_code:"report_autodna_vhr", limit, product_id}], revoking_data}:
 *     kredītu atlikums (lapa pati to lieto, lai rādītu "maksāt ar kredītiem" #payment-select-credit);
 *   - /vin/<VIN> (priekšpārbaude + grozs) no Hetzner IP rāda Cloudflare Turnstile ar ķeksi "Verificējiet, ka esat cilvēks"
 *     -> relejs to NEAPIET: needs_human (Nils atver saiti savā pārlūkā, pēc tam priekšpārbaude AutoDNA pusē ir gatava);
 *   - konta lapas /profile/summary, /profile/history (bez sesijas -> pāradresē uz sākumlapu).
 */

export const DNA_ORIGIN = "https://www.autodna.lv";
export const DNA_HOME_URL = `${DNA_ORIGIN}/`;
export const DNA_PROFILE_URLS = [`${DNA_ORIGIN}/profile/history`, `${DNA_ORIGIN}/profile/summary`];
export const DNA_VHR_REPORT_CODE = "report_autodna_vhr";

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

export function dnaVinUrl(vin) {
  return `${DNA_ORIGIN}/vin/${encodeURIComponent(normalizeVin(vin))}`;
}

/** Galvenā loga navigācija tikai uz autodna.lv (Turnstile, Google pogas u.c. iframe iet kā parasti). */
export function isAllowedHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "autodna.lv" || h === "www.autodna.lv";
}

/**
 * Ceļi, uz kuriem relejs NEKAD neiet: pakas / biznesa pakas (kredītu pirkums par naudu), rēķini, abonementi.
 * `/payment/*` atļauts tikai pirkuma brīdī, kad apmaksa ar KREDĪTU jau izvēlēta un pārbaudīta (sk. `isPaymentPath`).
 * Bankas / karšu vārtejas ir citos domēnos - tās bloķē `isAllowedHost`.
 */
export function isForbiddenPath(pathname) {
  const p = String(pathname ?? "").toLowerCase();
  return /^\/(pakas|biznesa-pakas|packages|checkout|billing|subscription|abonement)(\/|$)/.test(p) || /\/(invoice|rekins)(\/|$)/.test(p);
}

export function isPaymentPath(pathname) {
  return /^\/payment(\/|$)/i.test(String(pathname ?? ""));
}

/** `/ajax/client_login` atbilde. */
export function classifyLoginResponse(json) {
  if (!json || typeof json !== "object") return "unknown";
  if (Number(json.is_valid) === 1 || json.is_valid === true) return "ok";
  const msg = `${json.default_error ?? ""} ${JSON.stringify(json.errors ?? "")}`;
  if (/nepareiz|incorrect|invalid|wrong|błędn/i.test(msg)) return "bad_credentials";
  if (/kod|code|verif/i.test(msg)) return "code";
  if (/captcha|turnstile|robot/i.test(msg)) return "captcha";
  return "unknown";
}

const truthy = (v) => v === true || v === 1 || v === "1" || v === "true";

/** `/ajax/client_is_login` atbilde -> ielogots? + vai šim VIN atskaite jau nopirkta. Bez e-pasta (personas dati). */
export function parseIsLogin(json) {
  if (!json || typeof json !== "object") return { loggedIn: false, known: false, reportBought: false };
  const id = Number(json.client_id);
  const loggedIn = (Number.isFinite(id) && id > 0) || (typeof json.client_email === "string" && json.client_email.includes("@"));
  return {
    loggedIn,
    known: true,
    reportBought: truthy(json.report_bought),
    reportDate: typeof json.report_date === "string" ? json.report_date.slice(0, 40) : "",
    isReport: truthy(json.report_is_report),
    isTimeout: truthy(json.report_is_timeout),
  };
}

/**
 * Kredītu atlikums no `/ajax/get_client_credits`: vienas atskaites (report_autodna_vhr) kredīti.
 * Tukšs saraksts ielogotam lietotājam = 0. `null`, ja atbilde nav atpazīta.
 */
export function parseClientCredits(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.data)) return null;
  let total = 0;
  let seen = false;
  for (const row of json.data) {
    if (!row || typeof row !== "object") continue;
    if (row.report_code !== DNA_VHR_REPORT_CODE) continue;
    const n = Number(row.limit);
    if (!Number.isFinite(n)) continue;
    total += Math.max(0, Math.floor(n));
    seen = true;
  }
  if (seen) return total;
  return json.data.length === 0 ? 0 : null;
}

/** Atlikuma rezerve no lapas teksta ("Kredīti: 5", "Pieejamie kredīti 5", "5 kredīti"). */
export function parseCreditsFromText(text) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const patterns = [/pieejam\S* kred[iī]t\S*[:\s]*(\d{1,4})/i, /kred[iī]ti[:\s]+(\d{1,4})\b/i, /(\d{1,4})\s*kred[iī]t/i, /credits?[:\s]+(\d{1,4})\b/i];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Pirkuma lēmums (pirms jebkura klikšķa):
 *  - AutoDNA saka, ka šim VIN atskaite jau nopirkta -> lejupielādē, NEPĒRK;
 *  - relejs šo VIN jau pirka (reģistrs) -> NEPĒRK otrreiz, gaida atskaiti;
 *  - atlikums nav zināms vai < 1 -> NEPĒRK.
 */
export function decidePurchase({ bought, alreadyPurchased, credits }) {
  if (bought) return { action: "download", reason: "existing_report" };
  if (alreadyPurchased) return { action: "wait_existing", reason: "already_purchased" };
  if (typeof credits !== "number" || !Number.isFinite(credits)) return { action: "stop", reason: "balance_unknown" };
  if (credits < 1) return { action: "stop", reason: "insufficient_credits" };
  return { action: "purchase", reason: "ok" };
}

/** Pogas, ko pirkuma solī NEKAD nespiež (karte, pakas, bizness, cits auto). */
export const DNA_NEVER_CLICK_RE =
  /kart|card|blik|przelew|paypal|google pay|apple pay|bank|\bpak|package|bizn|business|abon|subscri|cits auto|another vehicle|komplekt|bundle/i;
/** Apmaksas apstiprinājuma poga (kredītu apmaksai). */
export const DNA_PAY_BUTTON_RE = /maks[aā]t|apmaks|pirkt|iegād|izmantot kred[iī]t|lejupiel[aā]d[eē]t atskait|saņemt atskait|pay|buy|use credit/i;

/**
 * Pirkuma lapas (/vin/<VIN> grozs) lēmums pēc DOM kopsavilkuma - pirms jebkura klikšķa.
 * @param {{
 *   turnstile?: boolean, pending?: boolean, invalidVin?: boolean, vinOnPage?: string,
 *   creditOption?: {present:boolean, checked?:boolean, disabled?:boolean},
 *   termsBoxes?: number, payButtons?: string[], totalText?: string
 * }} s
 * @param {string} vin
 */
export function analyzePurchasePage(s, vin) {
  const v = normalizeVin(vin);
  if (s.invalidVin) return { step: "invalid_vin" };
  if (s.turnstile) return { step: "turnstile" };
  if (s.pending) return { step: "pending" };
  if (s.vinOnPage && normalizeVin(s.vinOnPage) !== v) return { step: "vin_mismatch" };
  if (!s.creditOption?.present) return { step: "no_credit_option" };
  if (s.creditOption.disabled) return { step: "credit_disabled" };
  const buttons = (s.payButtons ?? []).map((b) => String(b ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const pay = buttons.filter((b) => b.length <= 60 && DNA_PAY_BUTTON_RE.test(b) && !DNA_NEVER_CLICK_RE.test(b));
  const unique = [...new Set(pay)];
  if (unique.length !== 1) return { step: "pay_button_unclear", buttons: unique.slice(0, 6) };
  return { step: "ready", payLabel: unique[0] };
}

/** Kredītu apmaksā kopsumma ir 0 (vai lapa raksta "kredīt"). Ja redzama nauda > 0 - nepērk. */
export function totalLooksLikeCredit(totalText) {
  const t = String(totalText ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/kred[iī]t|credit/i.test(t)) return true;
  const m = t.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)/i) ?? t.match(/(?:€|eur)\s*(\d+(?:[.,]\d{1,2})?)/i);
  if (!m) return true;
  return Number(m[1].replace(",", ".")) === 0;
}

/**
 * Atskaites lejupielādes saite: tikai autodna domēnos, ceļš ar download/pdf/report un (ja var) šo VIN.
 * @param {{href:string, text?:string}[]} links
 */
export function pickPdfHref(links, vin) {
  const v = normalizeVin(vin);
  const ranked = [];
  for (const l of links ?? []) {
    let u;
    try {
      u = new URL(String(l.href ?? ""), DNA_ORIGIN);
    } catch {
      continue;
    }
    if (!/(^|\.)autodna\.(lv|com|pl)$/i.test(u.hostname)) continue;
    if (u.protocol !== "https:") continue;
    const hay = `${u.pathname}${u.search} ${l.text ?? ""}`;
    if (!/download|pdf|lejupiel|pobierz/i.test(hay)) continue;
    if (/sample|piemer|example|terms|noteikum|qr_code|invoice|rekin/i.test(hay)) continue;
    const score = (hay.toUpperCase().includes(v) ? 2 : 0) + (/report_autodna_vhr|\.pdf\b/i.test(hay) ? 1 : 0);
    ranked.push({ href: u.toString(), score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.href ?? "";
}

/** "Manas atskaites" rindas (konta vēsture): VIN + saite + datums no lapas rindām. Bez personas datiem. */
export function parseHistoryRows(rows) {
  const out = [];
  for (const r of rows ?? []) {
    const text = String(r?.text ?? "");
    const m = text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    if (!m) continue;
    const date = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})\b/)?.[1] ?? "";
    out.push({ vin: m[0], date, links: (r.links ?? []).slice(0, 10) });
  }
  return out;
}

export function isPdfBase64(b64) {
  if (typeof b64 !== "string" || b64.length < 8) return false;
  try {
    return Buffer.from(b64.slice(0, 12), "base64").subarray(0, 5).toString("latin1") === "%PDF-";
  } catch {
    return false;
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Žurnālam / debug: noslēpumi (arī URL kodēti), e-pasti, Bearer tokeni -> ***. */
export function redact(text, secrets = []) {
  let out = String(text ?? "");
  for (const s of secrets) {
    if (!s || String(s).length < 4) continue;
    for (const variant of new Set([String(s), encodeURIComponent(String(s))])) out = out.split(variant).join("***");
  }
  return out
    .replace(EMAIL_RE, "***@***")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, "Bearer ***")
    .replace(/password=[^&\s"]*/gi, "password=***");
}
