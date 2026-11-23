/**
 * e.csdd.lv / Vienotās pieteikšanās (vpm.viss.gov.lv, latvija.lv) lapu atpazīšana bez pārlūka.
 * Tīras funkcijas; testi: lib/ecsdd-relay.test.ts repo saknē.
 *
 * Pārbaudīts 23.10.2026 (bez pieteikšanās):
 *  - e.csdd.lv "Autorizēties visām darbībām" -> https://e.csdd.lv/simplesaml/ -> vpm.viss.gov.lv/LVP.STS/Account/Login
 *    (ķeksītis name="agree" + pogas `.js--vpm-auth-button`, Smart-ID = data-url ar scheme=smartid)
 *    -> vpm.viss.gov.lv/VPM.IdP.SmartId/... (lauks #identity-number "Personas kods", poga #ok "Autentificēties").
 *  - "Autorizēties uzziņai" / "Reģistrētiem lietotājiem" (e-pasts + parole) vairs nav: lapa piedāvā tikai
 *    "Autorizēties visām darbībām". Tāpēc serveris var pieteikties tikai ar Vienoto pieteikšanos.
 *  - Lapas pēc pieteikšanās (ielogots sākums, tadati rezultāts) vēl nav redzētas - atpazīšana ir teksta bāzēta.
 *  - 23.11.2026: Smart-ID adapteris pēc personas koda rāda koda lapu, ko vecā atpazīšana sajauca ar metodes izvēli.
 *    SSO soļi tagad ir `viss-sso.mjs` (identisks LTAB relejā).
 */
import { classifySso, isSsoHost } from "./viss-sso.mjs";

export { extractVerificationCode, isSsoHost, looksLikeSsoFailure } from "./viss-sso.mjs";

export const ECSDD_HOME_URL = "https://e.csdd.lv/";
export const ECSDD_SSO_URL = "https://e.csdd.lv/simplesaml/";
export const ECSDD_TADATI_URL = "https://e.csdd.lv/tadati/";

/** Galvenā loga navigācija tikai uz šiem hostiem (pārējo bloķē). */
export function isAllowedHost(host) {
  const h = String(host ?? "").toLowerCase();
  return (
    isEcsddHost(h) ||
    isSsoHost(h) ||
    // Smart-ID ikonas / skripti pieteikšanās lapā
    h.endsWith(".smart-id.com") ||
    h.endsWith(".sk.ee")
  );
}

export function isEcsddHost(host) {
  return String(host ?? "").toLowerCase() === "e.csdd.lv";
}

/** Numurzīme vai VIN tādā formā, kā to pieņem e.csdd meklēšanas lauks `rn`. */
export function normalizeQuery(raw) {
  return String(raw ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
}

/** `vin` (17 zīmes, bez I/O/Q) | `plate` (LV numurzīme 2-8 zīmes ar burtu) | null. */
export function queryKind(raw) {
  const q = normalizeQuery(raw);
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(q) && /\d/.test(q)) return "vin";
  if (/^[A-Z0-9]{2,8}$/.test(q) && /[A-Z]/.test(q)) return "plate";
  return null;
}

/** Personas kods tikai formāta pārbaudei, nekad netiek logots. */
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
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hour: "2-digit", hourCycle: "h23" }).format(date));
}

/** Darba laiks Rīgā [fromHour, toHour). Ārpus tā automātika Smart-ID neprasa un sesiju neuztur. */
export function isWorkHoursRiga(date = new Date(), fromHour = 8, toHour = 20) {
  const h = rigaHour(date);
  return h >= fromHour && h < toHour;
}

const CAPTCHA_RE = /captcha|recaptcha|hcaptcha|neesmu\s+robots|i'?m\s+not\s+a\s+robot/i;
const LOGGED_OUT_RE = /autoriz[eē]ties\s+vis[aā]m\s+darb[iī]b[aā]m|izv[eē]lieties\s+pieteik[sš]an[aā]s\s+veidu|var\s+izmantot\s+tikai\s+re[gģ]istr[eē]ti\s+lietot[aā]ji/i;
const LOGOUT_CONTROL_RE = /\b(iziet|izrakst[iī]ties|beigt\s+darbu|atteikties|log\s*out)\b/i;
const NOT_FOUND_RE =
  /(transportl[iī]dzeklis|ieraksts|dati)\s+(nav\s+atrast|netika\s+atrast)|nav\s+atrasts|netika\s+atrasts|nav\s+(re[gģ]istr[eē]ts|datu)|nepareizs\s+(re[gģ]istr[aā]cijas\s+)?numurs|nekorekt/i;
const RESULT_RE = /(re[gģ]istr[aā]cijas\s+numurs|marka|tehnisk[aā]\s+apskate|nobraukuma\s+v[eē]sture|odometra\s+r[aā]d[iī]jums)/i;
const PAY_RE = /apmaks|samaks|maks[aā]jum|pirkt|iegād|grozs/i;

export function isPayText(text) {
  return PAY_RE.test(String(text ?? ""));
}

/**
 * snapshot: { host, path, text, inputs:[{label,type,visible,id}], buttons:[{text,visible}], links:[{text,href}],
 *             codeCandidates, digitCandidates, hasAgree, smartIdChoice, smartIdAdapter, hasCaptchaFrame }
 * opts.submitted: vai tadati meklēšana jau iesniegta šajā lapā.
 * snap.accounts: [{id, name}] no "Izvēlies kontu"; snap.hasLogout: #logout ("Iziet") ir lapā (arī paslēpts izvēlnē).
 * Atgriež: captcha | ecsdd_logged_out | ecsdd_logged_in | ecsdd_account_choose | tadati_result | tadati_not_found |
 *          sso_choose | sso_code_input | sso_wait | sso_failed | unknown
 */
export function classifySnapshot(snap, opts = {}) {
  const host = String(snap?.host ?? "");
  const text = String(snap?.text ?? "");
  const buttons = (snap?.buttons ?? []).filter((b) => b.visible !== false);
  const links = snap?.links ?? [];
  if (CAPTCHA_RE.test(text) || snap?.hasCaptchaFrame) return "captcha";

  if (isSsoHost(host)) return classifySso(snap);

  if (isEcsddHost(host)) {
    // Pēc pieteikšanās (vai /?userlist=true): "Izvēlies kontu" - privātpersona + juridiskās personas.
    if ((snap?.accounts ?? []).length > 0 && (snap?.accountSwitch || /izv[eē]lies\s+kontu/i.test(text))) return "ecsdd_account_choose";
    const hasLogout =
      Boolean(snap?.hasLogout) ||
      buttons.some((b) => LOGOUT_CONTROL_RE.test(b.text)) ||
      links.some((l) => LOGOUT_CONTROL_RE.test(String(l.text ?? "")) || /logout|action=exit|iziet/i.test(String(l.href ?? "")));
    if (!hasLogout && LOGGED_OUT_RE.test(text)) return "ecsdd_logged_out";
    if (opts.submitted) {
      if (NOT_FOUND_RE.test(text)) return "tadati_not_found";
      if (RESULT_RE.test(text) && /\b[A-HJ-NPR-Z0-9]{17}\b|\b\d{2}\.\d{2}\.\d{4}\b/.test(text)) return "tadati_result";
    }
    if (hasLogout) return "ecsdd_logged_in";
    return "unknown";
  }
  return "unknown";
}

const fold = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const COMPANY_RE = /sabiedr[iī]ba|\bSIA\b|\bAS\b|akciju|"|„|biedr[iī]ba|nodibin[aā]jums|kooperat|\bIK\b|\bZS\b|komersant/i;

/**
 * Kuru kontu izvēlēties lapā "Izvēlies kontu". pref: "person" (noklusējums; privātpersonas konts = id "1" vai
 * pirmais, kas nav uzņēmums) vai nosaukuma fragments (piem. "ĪRISS"; bez garumzīmju/reģistra atšķirības).
 * Atgriež indeksu `accounts` masīvā vai -1 (prasītais konts nav sarakstā - nekad neizvēlamies citu).
 */
export function pickAccountIndex(accounts, pref = "person") {
  const list = accounts ?? [];
  const want = fold(pref) || "person";
  if (want === "person" || want === "privatpersona") {
    const byId = list.findIndex((a) => String(a.id) === "1" && !COMPANY_RE.test(String(a.name ?? "")));
    if (byId >= 0) return byId;
    return list.findIndex((a) => !COMPANY_RE.test(String(a.name ?? "")));
  }
  const hits = list.map((a, i) => (fold(a.name).includes(want) ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}

/**
 * `tadati` akordeona paneļi (pārlūkā savākti: [{title, rows: [[šūna, ...]]}], arī aizvērtie) -> raw teksts
 * tādā pašā formā kā Nila ielīmējums: "Tehniskie dati\nPārbaudes veids:\tPamatpārbaude\n...".
 */
export function formatTadatiPanels(panels, footer = "", secrets = []) {
  const out = [];
  for (const p of panels ?? []) {
    const title = String(p?.title ?? "").replace(/\s+/g, " ").trim();
    const rows = (p?.rows ?? [])
      .map((r) => (r ?? []).map((c) => String(c ?? "").replace(/\s+/g, " ").trim()))
      .filter((r) => r.some(Boolean))
      .map((r) => r.join("\t").replace(/\t+$/, ""));
    if (!title && !rows.length) continue;
    if (out.length) out.push("");
    if (title) out.push(title);
    out.push(...rows);
  }
  if (!out.length) return "";
  const foot = String(footer ?? "").replace(/\s+/g, " ").trim();
  if (foot) out.push("", foot);
  const lines = out.map((l) => {
    const m = l.match(PERSON_LINE_RE);
    return m && m[4].trim() ? `${m[1]}${m[2]} ***` : l;
  });
  return redact(lines.join("\n"), secrets).slice(0, 60_000);
}

/** Rindas ar personas datiem (vārds, adrese) tadati tekstā aizvieto ar `Etiķete ***`. */
const PERSON_LINE_RE =
  /^(\s*)(Īpašnieks|Ipasnieks|Turētājs|Turetajs|Valdītājs|Lietotājs|Pilnvarotā\s+persona|Pilnvarotais|Adrese|Deklarētā\s+adrese|Personas\s+kods|Vārds,?\s+uzvārds)\b(?!\s*(skaits|maiņ|main))(.*)$/i;

const MENU_LINES = new Set(
  [
    "Tehniskā apskate",
    "Transportlīdzekļu reģistrācija",
    "Maksājumi",
    "Vadītāja apliecības un dokumenti",
    "Sodi un pārkāpumi",
    "CSDD eksāmeni un kursi",
    "Kravas automobiļu sertifikācija",
  ].map((s) => s.toLowerCase()),
);

/** Lapas apakšējā izvēlne (tā pati visās e.csdd lapās) nav auto dati. */
function trimTrailingMenu(lines) {
  const out = [...lines];
  while (out.length && (out[out.length - 1].trim() === "" || MENU_LINES.has(out[out.length - 1].trim().toLowerCase()))) out.pop();
  return out;
}

/**
 * e.csdd `tadati` lapas teksts -> raw teksts CSDD blokam (tāds pats kā Nila ielīmējums).
 * Izmet galveni/kājeni, personas kodus un personu rindas. Atgriež "" ja nav ko atgriezt.
 */
export function extractTadatiText(fullText, secrets = []) {
  let t = String(fullText ?? "").replace(/\r/g, "").replace(/ /g, " ");
  // Kājene sākas ar "Tehniskais atbalsts" (sk. e.csdd lapas). Galvene beidzas pirms pirmā datu lauka.
  const footer = t.search(/\n\s*Tehniskais atbalsts\s*\n/i);
  if (footer > 0) t = t.slice(0, footer);
  const start = t.search(/(Reģistrācijas numurs|Marka|Statuss|Transportlīdzekļa)/i);
  if (start > 0) t = t.slice(start);
  const lines = trimTrailingMenu(t.split("\n"))
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .map((l) => {
      const m = l.match(PERSON_LINE_RE);
      return m && m[4].trim() ? `${m[1]}${m[2]} ***` : l;
    })
    .filter((l, i, arr) => !(l.trim() === "" && (arr[i - 1] ?? "").trim() === ""));
  return redact(lines.join("\n").trim(), secrets).slice(0, 60_000);
}
