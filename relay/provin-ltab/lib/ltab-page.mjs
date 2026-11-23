import { classifySso, isSsoHost } from "./viss-sso.mjs";

export { extractVerificationCode, looksLikeSsoFailure as looksLikeSmartIdFailure } from "./viss-sso.mjs";

/**
 * LTAB / Vienotās pieteikšanās (vpm.viss.gov.lv, agrāk latvija.lv) lapu atpazīšana bez pārlūka (tīras funkcijas, testi: lib/ltab-relay.test.ts repo saknē).
 * Pārlūks (`ltab-flow.mjs`) savāc lapas kopsavilkumu (`snapshot`), šeit izlemj, kas tā ir un ko darīt.
 * Selektori ir teksta bāzēti, jo lapu pēc pieteikšanās vēl neesam redzējuši (Posms 0 ar Nilu).
 * 23.11.2026: LTAB pieteikšanās tagad ved uz vpm.viss.gov.lv (sk. `viss-sso.mjs`).
 * 23.11.2026 (redzēts ielogots): forma `form.form-ins` ar #regNumber ("Reģistrācijas numurs") un #chassisNumber
 *   (izslēgts; nelietojam - LTAB tikai pēc LV numura), poga "Meklēt", "Beigt darbu" (/VehicleInsAndAcc/VpSignout).
 *   Rezultāts tajā pašā lapā: "Negadījumu skaits N", "... nav reģistrēts neviens negadījums", poga `.print`
 *   "Lejupielādēt izziņu" -> window.open("/VehicleInsAndAcc/Print") = oriģinālais PDF.
 */

export const LTAB_START_URL = "https://services.ltab.lv/VehicleInsAndAcc";

/** Releja pārlūks drīkst atvērt tikai šos hostus (pārējo bloķē tīklā). */
export function isAllowedHost(host) {
  const h = String(host ?? "").toLowerCase();
  return (
    h === "services.ltab.lv" ||
    h === "www.ltab.lv" ||
    h === "ltab.lv" ||
    // Vienotā pieteikšanās: vpm.viss.gov.lv (no 2026) un vecais latvija.lv
    isSsoHost(h) ||
    // Smart-ID ikonas / skripti pieteikšanās lapā
    h.endsWith(".smart-id.com") ||
    h.endsWith(".sk.ee")
  );
}

/** Pieteikšanās (SSO) hosts: vpm.viss.gov.lv vai latvija.lv. */
export function isLatvijaHost(host) {
  return isSsoHost(host);
}

export function isLtabHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "services.ltab.lv";
}

/** LV numurzīme (pēc normalizācijas), tā pati robeža kā Vercel `isValidLtabPlate`. */
export function normalizePlate(raw) {
  return String(raw ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidPlate(raw) {
  const n = normalizePlate(raw);
  return /^[A-Z0-9]{2,8}$/.test(n) && /[A-Z]/.test(n);
}

/** Personas kods tikai pārbaudei (formāts), nekad netiek logots. */
export function isValidPersonalCode(raw) {
  return /^\d{6}-?\d{5}$/.test(String(raw ?? "").trim());
}

/** Žurnālā nekad: personas kodi (arī bez defises) un env noslēpumi. */
export function redact(text, secrets = []) {
  let out = String(text ?? "");
  for (const s of secrets) {
    const v = String(s ?? "").trim();
    if (v.length >= 6) out = out.split(v).join("***");
    const digits = v.replace(/\D/g, "");
    if (digits.length === 11) out = out.split(digits).join("***");
  }
  return out.replace(/\b\d{6}-?\d{5}\b/g, "***");
}

/** Rīgas stunda (0-23). */
export function rigaHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hour: "2-digit", hourCycle: "h23" }).format(date),
  );
}

/** Naktī (22:00-07:00) automātika Smart-ID neprasa - uzdevums gaida rītu. */
export function isNightInRiga(date = new Date(), fromHour = 22, toHour = 7) {
  const h = rigaHour(date);
  return h >= fromHour || h < toHour;
}

const CONSENT_RE = /inform[eē]t|piekr[iī]t|apliecin|apstiprin|personas\s+dat|noteikum|datu\s+apstr|esmu\s+iepazin/i;
const PAY_RE = /apmaks|samaks|maks[aā]jum|pirkt|iegād/i;
const SEARCH_FIELD_RE = /re[gģ]istr|numur|reg\s*number|nr\.?|vin|šasij|sasij|chassis|plate/i;
const SEARCH_BUTTON_RE = /mekl[eē]t|atlas[iī]t|p[aā]rbaud[iī]t|iesniegt\s+piepras|search/i;
const PDF_RE = /\bpdf\b|izzi[nņ]|lejupiel|druk[aā]t|download/i;
const NO_RESULT_RE =
  /nav\s+(atrast|re[gģ]istr|ierakst|zaud[eē]jum|negad[iī]jum)|netika\s+atrast|ieraksti\s+nav|nav\s+datu|0\s+negad[iī]jum|negad[iī]jumu\s+skaits\s*:?\s*0\b/i;
const RESULT_RE = /negad[iī]jumu\s+skaits\s*:?\s*[1-9]|CSNg|cietu[sš]ais|atbild[iī]gs|norakst[aā]m/i;
const ACCIDENT_COUNT_RE = /negad[iī]jumu\s+skaits\s*:?\s*(\d{1,3})(?!\d)/i;

/**
 * Negadījumu skaits no rezultāta lapas ("Negadījumu skaits 0" - LTAB 23.11.2026 izkārtojums) vai `null`.
 */
export function extractAccidentCount(text) {
  const m = String(text ?? "").replace(/\s+/g, " ").match(ACCIDENT_COUNT_RE);
  return m ? Number(m[1]) : null;
}
const CAPTCHA_RE = /captcha|recaptcha|hcaptcha|neesmu\s+robots|i'?m\s+not\s+a\s+robot/i;

export function isConsentLabel(label) {
  const t = String(label ?? "");
  return CONSENT_RE.test(t) && !PAY_RE.test(t);
}

export function isPayText(text) {
  return PAY_RE.test(String(text ?? ""));
}

export function isSearchFieldLabel(label) {
  return SEARCH_FIELD_RE.test(String(label ?? ""));
}

export function isSearchButtonText(text) {
  const t = String(text ?? "");
  return SEARCH_BUTTON_RE.test(t) && !PAY_RE.test(t);
}

export function isPdfControlText(text) {
  const t = String(text ?? "");
  return PDF_RE.test(t) && !PAY_RE.test(t);
}

/**
 * snapshot: { host, text, checkboxes: [{label, checked, visible}], inputs: [{label, type, visible}],
 *             buttons: [{text, visible}], hasVdar }
 * opts.submitted: vai "Meklēt" jau nospiests.
 * Atgriež: ltab_login | ltab_search | ltab_result_none | ltab_result_found | sso_choose |
 *          sso_code_input | sso_wait | sso_failed | captcha | unknown (SSO soļi: `viss-sso.mjs`)
 */
export function classifySnapshot(snap, opts = {}) {
  const host = String(snap?.host ?? "");
  const text = String(snap?.text ?? "");
  const inputs = (snap?.inputs ?? []).filter((i) => i.visible !== false);
  const buttons = (snap?.buttons ?? []).filter((b) => b.visible !== false);
  if (CAPTCHA_RE.test(text) || snap?.hasCaptchaFrame) return "captcha";

  if (isSsoHost(host)) return classifySso(snap);

  if (isLtabHost(host)) {
    if (snap?.hasVdar) return "ltab_login";
    const hasSearch =
      inputs.some((i) => i.id === "regNumber" || (/text|search|^$/.test(String(i.type ?? "")) && isSearchFieldLabel(i.label))) &&
      buttons.some((b) => isSearchButtonText(b.text));
    // Pirms "Meklēt" lapas virsrakstā jau ir "zaudējumu dati", tāpēc rezultātu vērtē tikai pēc meklēšanas.
    if (!opts.submitted) return hasSearch ? "ltab_search" : "unknown";
    // Rezultāts paliek tajā pašā lapā zem meklēšanas formas; skaits ir drošākais signāls.
    const count = extractAccidentCount(text);
    if (count === 0) return "ltab_result_none";
    if (count !== null && count > 0) return "ltab_result_found";
    if (NO_RESULT_RE.test(text)) return "ltab_result_none";
    if (RESULT_RE.test(text) || buttons.some((b) => isPdfControlText(b.text))) return "ltab_result_found";
    return hasSearch ? "ltab_search" : "unknown";
  }
  return "unknown";
}
