/**
 * Traficom releja lapu atpazīšana un rezultāta apstrāde bez pārlūka (tīras funkcijas; testi: lib/traficom-relay.test.ts).
 *
 * Ceļš (pārbaudīts 26.11.2026 līdz eParaksts ievades lapai, bez pieteikšanās):
 *  1. asiointi.traficom.fi/oma-asiointi/julkiset-tiedonhakupalvelut/julkiset-ajoneuvotiedot-ja-veron-maksu
 *     -> tunnistautuminen.suomi.fi/sivut/discovery-page: `a#eidas_high` ("Ulkomaalaisen tunnistustavat" / foreigners)
 *  2. tunnistautuminen.suomi.fi/sivut/country-selection: `a#LV` (Latvia)
 *  3. vpm.viss.gov.lv/LVP.STS/Account/Login: ķeksītis name="agree" + `.js--vpm-auth-button[data-url*="scheme=mobile_eidas"]`
 *     ("eParaksts Mobile"; citas: eid_eidas, mobeid_eidas - nelietojam)
 *  4. eidas.eparaksts.lv/trustedx-authserver/lvrtc-eipsign-idp/mobileIdIdentification.xhtml:
 *     `#identifierForm-identifier` ("USER NUMBER") + `#identifierForm-submitButton` ("Confirm"), "Cancel" nekad.
 *  4b. (27.11, jauns pārlūks) eParaksts "Enter the code you see in the eParaksts mobile app ... confirm this browser":
 *     kods redzams tikai Nila telefonā -> relejs gaida kodu no admina (POST /traficom/session/browser-code), ievada,
 *     spiež "Confirm". "Send code via SMS" un "Cancel" nekad. Pēc tam eParaksts šo pārlūka profilu atceras.
 *  5. (Nils telefonā apstiprina) -> userConsent "Agree" -> suomi.fi "Continue to service" -> Traficom.
 *  6. Traficom: 1. solis "Instructions" -> "Next"; 2. solis "Find vehicle information" -> "by vehicle identification
 *     number (VIN)" + VIN + "Vehicle type" + "Search"; 3. solis "Vehicle information" (bezmaksas dati).
 *     Akordeoni ar "(information subject to a fee)" un solis "Payment" - NEKAD.
 */

export const TRAFICOM_SERVICE_URL =
  "https://asiointi.traficom.fi/oma-asiointi/julkiset-tiedonhakupalvelut/julkiset-ajoneuvotiedot-ja-veron-maksu";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

export function isValidVin(raw) {
  return VIN_RE.test(normalizeVin(raw));
}

/** eParaksts lietotāja numurs (formāts tikai pārbaudei; vērtība nekad netiek logota). */
export function isValidUserNumber(raw) {
  const t = String(raw ?? "").trim();
  return /^[0-9A-Za-z-]{6,24}$/.test(t);
}

export function isTraficomHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "asiointi.traficom.fi" || h.endsWith(".asiointi.traficom.fi") || h === "asiointi-idp.traficom.fi";
}

export function isSuomiFiHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "tunnistautuminen.suomi.fi" || h.endsWith(".tunnistautuminen.suomi.fi") || h === "suomi.fi" || h.endsWith(".suomi.fi");
}

export function isVpmHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "viss.gov.lv" || h.endsWith(".viss.gov.lv");
}

export function isEparakstsHost(host) {
  const h = String(host ?? "").toLowerCase();
  return h === "eparaksts.lv" || h.endsWith(".eparaksts.lv");
}

/**
 * eParaksts pārlūka apstiprināšanas kods (no eParaksts mobile lietotnes): tikai burti/cipari, 4-8 zīmes.
 * Atstarpes un defises, ko cilvēks ieraksta pa vidu ("12 34"), noņem. Nederīgs -> "".
 */
export function normalizeBrowserCode(raw) {
  const t = String(raw ?? "").trim().replace(/[\s-]/g, "");
  return /^[0-9A-Za-z]{4,8}$/.test(t) ? t.toUpperCase() : "";
}

export function isValidBrowserCode(raw) {
  return normalizeBrowserCode(raw) !== "";
}

/** "Code valid for: 00:43" / "Kods derīgs: 00:43" / "valid for 43 s" -> sekundes (null, ja nav). */
export function extractCodeValidSeconds(text) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const lead = "(?:valid\\s+for|der[iī]gs(?:\\s+v[eē]l)?|der[iī]guma\\s+termi[nņ][sš]|voimassa|giltig)";
  const mm = t.match(new RegExp(`${lead}\\s*:?\\s*(\\d{1,2}):(\\d{2})(?!\\d)`, "iu"));
  if (mm) return Number(mm[1]) * 60 + Number(mm[2]);
  const ss = t.match(new RegExp(`${lead}\\s*:?\\s*(\\d{1,3})\\s*(?:s|sec|seconds?|sek(?:undes|undēm)?)\\b`, "iu"));
  if (ss) return Number(ss[1]);
  return null;
}

const BROWSER_CODE_RE =
  /confirm\s+this\s+browser|enter\s+the\s+code\s+you\s+see|code\s+from\s+the\s+(?:eparaksts\s+)?(?:mobile\s+)?app|apstipriniet\s+[sš]o\s+p[aā]rl[uū]k|apstiprin[aā]t\s+[sš]o\s+p[aā]rl[uū]k|ievadiet\s+kodu|kodu,?\s+ko\s+redzat/i;

/** eParaksts lapa "confirm this browser" ar koda lauku (nevis lietotāja numura forma). */
export function isBrowserCodeSnapshot(snap) {
  if (!isEparakstsHost(snap?.host)) return false;
  if (!BROWSER_CODE_RE.test(String(snap?.text ?? ""))) return false;
  return (snap?.inputs ?? []).some(
    (i) =>
      i.visible !== false &&
      i.id !== "identifierForm-identifier" &&
      !/checkbox|radio|hidden|submit|button/.test(String(i.type ?? "")) &&
      !/user\s*number|lietot[aā]ja\s+numur/i.test(String(i.label ?? "")),
  );
}

/** Releja pārlūka galvenais logs drīkst atvērt tikai šos hostus (pārējo bloķē). */
export function isAllowedHost(host) {
  const h = String(host ?? "").toLowerCase();
  return (
    isTraficomHost(h) ||
    h === "traficom.fi" ||
    h.endsWith(".traficom.fi") ||
    isSuomiFiHost(h) ||
    isVpmHost(h) ||
    isEparakstsHost(h) ||
    // eIDAS mezgli (Somijas / Latvijas proxy) pāradresācijās
    h.endsWith(".eidas.fi") ||
    // Somijas eIDAS mezgls (27.11: nodefi1.eidas.tunnistus.fi)
    h === "tunnistus.fi" ||
    h.endsWith(".tunnistus.fi") ||
    // Latvijas eIDAS mezgls / VDAA (VISS)
    h.endsWith(".vdaa.gov.lv") ||
    h.endsWith(".vraa.gov.lv") ||
    h.endsWith(".eidas.gov.lv") ||
    h.endsWith(".lvrtc.lv")
  );
}

/** Žurnālā nekad: lietotāja numurs (arī bez defises), personas kodi un env noslēpumi. */
export function redact(text, secrets = []) {
  let out = String(text ?? "");
  for (const s of secrets) {
    const v = String(s ?? "").trim();
    if (v.length >= 4) out = out.split(v).join("***");
    const compact = v.replace(/[^0-9A-Za-z]/g, "");
    if (compact.length >= 6) out = out.split(compact).join("***");
    const digits = v.replace(/\D/g, "");
    if (digits.length === 11) out = out.split(`${digits.slice(0, 6)}-${digits.slice(6)}`).join("***");
  }
  return out.replace(/\b\d{6}-?\d{5}\b/g, "***");
}

/** Maksas lietas: uz tām relejs nekad neklikšķina (solis "Payment", "SERVICE PRICE", maksas akordeoni). */
const FEE_RE =
  /subject\s+to\s+a\s+fee|maksullinen|maksullis|avgiftsbelag|\bpayment\b|\bpay\b|maksa(?:a|mi|minen|maan|tus)|service\s+price|palvelun\s+hinta|\bprice\b|\bhinta\b|\bbuy\b|\bosta\b|checkout|kassa|\bfee\b|€/i;

export function isFeeText(text) {
  return FEE_RE.test(String(text ?? ""));
}

/** Maksas akordeoni (Owners and holders, Owner history, Inspection history, ...) - nekad neatver, nelasa. */
const FEE_SECTION_TITLES = [
  /owners?\s+and\s+holders?/i,
  /owner\s+history/i,
  /inspection\s+history/i,
  /insurance\s+history/i,
  /use\s+history/i,
  /decommissioning\s+history/i,
  /omistaj|haltij|katsastushistoria|vakuutushistoria|käyttöhistoria|poistohistoria/i,
];

/** Akordeona virsraksts ir maksas (NB: "Tax information and payment" ir bezmaksas - vārds "payment" pats par sevi neskaitās). */
export function isFeeSectionTitle(title) {
  const t = String(title ?? "");
  return /subject\s+to\s+a\s+fee|maksullinen|maksullis|avgiftsbelag|€/i.test(t) || FEE_SECTION_TITLES.some((re) => re.test(t));
}

const CAPTCHA_RE = /captcha|recaptcha|hcaptcha|i'?m\s+not\s+a\s+robot|en\s+ole\s+robotti/i;
const EP_FAIL_RE =
  /cancel+ed|refused|rejected|expired|timed?\s*out|not\s+confirmed|authentication\s+failed|atcelts|atteikts|noraid|beidzies|neizdev[aā]s|user\s+not\s+found|lietot[aā]js\s+nav\s+atrasts|invalid\s+user/i;
const NOT_FOUND_RE =
  /no\s+vehicle\s+(was\s+)?found|vehicle\s+not\s+found|no\s+results|ajoneuvoa\s+ei\s+l[öo]ytynyt|ei\s+l[öo]ytynyt|tietoja\s+ei\s+l[öo]ytynyt|check\s+the\s+vehicle\s+identification\s+number/i;

/**
 * Lapas veids pēc kopsavilkuma.
 * snapshot: { host, path, text, inputs:[{id,name,type,label,visible}], buttons:[{id,text,visible}], hasAgree,
 *             mobileChoice, hasCaptchaFrame, stepText (aktīvais vedņa solis), headings }
 * Atgriež: fi_choose_method | fi_choose_country | fi_continue | vpm_choose | ep_user_number | ep_browser_code | ep_wait | ep_consent |
 *          ep_failed | tf_instructions | tf_search | tf_result | tf_not_found | tf_payment | tf_other | captcha | unknown
 */
export function classifySnapshot(snap) {
  const host = String(snap?.host ?? "");
  const path = String(snap?.path ?? "");
  const text = String(snap?.text ?? "");
  const inputs = (snap?.inputs ?? []).filter((i) => i.visible !== false);
  const buttons = (snap?.buttons ?? []).filter((b) => b.visible !== false);
  const hasBtn = (re) => buttons.some((b) => re.test(String(b.text ?? "")));
  const hasBtnId = (id) => buttons.some((b) => b.id === id);

  if (CAPTCHA_RE.test(text) || snap?.hasCaptchaFrame) return "captcha";

  if (isSuomiFiHost(host)) {
    if (hasBtnId("eidas_high")) return "fi_choose_method";
    if (hasBtnId("LV")) return "fi_choose_country";
    if (hasBtn(/continue\s+to\s+(the\s+)?service|jatka\s+palveluun|siirry\s+palveluun|forts[aä]tt\s+till\s+tj[aä]nsten/i)) return "fi_continue";
    return "unknown";
  }

  if (isVpmHost(host)) {
    if (snap?.mobileChoice || snap?.hasAgree) return "vpm_choose";
    if (hasBtn(/^\s*(agree|piekr[iī]tu|i\s+agree)\s*$/i)) return "ep_consent";
    if (EP_FAIL_RE.test(text)) return "ep_failed";
    return "unknown";
  }

  if (isEparakstsHost(host)) {
    // Pārlūka apstiprināšana ar kodu no lietotnes - pirms visa pārējā (lapā var būt arī "expired").
    if (isBrowserCodeSnapshot(snap)) return "ep_browser_code";
    if (inputs.some((i) => i.id === "identifierForm-identifier" || /user\s*number|lietot[aā]ja\s+numur/i.test(String(i.label ?? "")))) {
      return EP_FAIL_RE.test(text) ? "ep_failed" : "ep_user_number";
    }
    if (/userconsent/i.test(path) || hasBtn(/^\s*(agree|piekr[iī]tu)\s*$/i)) return "ep_consent";
    if (EP_FAIL_RE.test(text)) return "ep_failed";
    return "ep_wait";
  }

  if (isTraficomHost(host)) {
    // Aktīvais vedņa solis (tikai tas - pakalpojuma nosaukumā "... ja veron maksu" / "tax payments" arī ir "maksu").
    const active = String(snap?.stepText ?? "");
    // Maksājuma solis - nekad.
    if (/^\s*\d*\s*(payment|maksu|maksaminen|betalning)\b/i.test(active) || /\/(maksu|payment|kassa|checkout)(\/|$)/i.test(path)) return "tf_payment";
    if (NOT_FOUND_RE.test(text) && inputs.some((i) => /vin|valmistenumero|identification/i.test(`${i.label} ${i.name} ${i.id}`))) {
      return "tf_not_found";
    }
    if (/^\s*\d*\s*(vehicle\s+information|ajoneuvon\s+tiedot)/i.test(active) || (/source\s*:\s*transport\s+register|l[aä]hde\s*:\s*liikennerekisteri/i.test(text) && /tax\s+status|verotilanne|vehicle\s+status|ajoneuvon\s+tila/i.test(text))) {
      return "tf_result";
    }
    if (/^\s*\d*\s*(find\s+vehicle|hae\s+ajoneuvo|etsi\s+ajoneuvo)/i.test(active) || inputs.some((i) => /vin|valmistenumero|vehicle\s+identification/i.test(`${i.label} ${i.name} ${i.id}`))) {
      return "tf_search";
    }
    if (/^\s*\d*\s*(instructions|ohjeet)/i.test(active) || hasBtn(/^\s*(next|seuraava)\s*›?\s*$/i)) return "tf_instructions";
    return "tf_other";
  }
  return "unknown";
}

/** eParaksts kontrolkods (ja lapa to rāda): "Control code: 1234" / "Verification code 12AB" vai elements ar code klasi. */
export function extractVerificationCode(text, candidates = []) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const m = t.match(/(control|verification|security|kontrol\p{L}*|dro[sš][iī]bas|p[aā]rbaudes)\s*(code|kods|koda|kodu)\s*[:\-]?\s*([0-9]{4,6}|[0-9A-Z]{4})(?![0-9A-Za-z])/iu);
  if (m) return m[3];
  for (const c of candidates ?? []) {
    const v = String(c ?? "").replace(/\s+/g, "");
    if (/^[0-9]{4,6}$/.test(v)) return v;
  }
  return null;
}

const clean = (s, max = 400) =>
  String(s ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function cleanRows(rows, secrets) {
  const out = [];
  const seen = new Set();
  for (const r of rows ?? []) {
    if (!Array.isArray(r)) continue;
    const label = clean(redact(r[0], secrets), 160);
    const value = clean(redact(r[1], secrets), 600);
    if (!label || !value || label === value) continue;
    // Maksas norādes rindas (piem. "SERVICE PRICE 2,75 €") neņemam.
    if (/service\s+price|palvelun\s+hinta/i.test(label)) continue;
    const key = `${label}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([label, value]);
  }
  return out.slice(0, 200);
}

function toneOf(raw) {
  const t = String(raw ?? "").toLowerCase();
  if (/red|error|danger|alert|critical|negative|severe|prohibit/.test(t)) return "red";
  if (/yellow|warn|notice|caution|attention|info/.test(t)) return "yellow";
  return "";
}

/** Sarkanie karogi pēc teksta (ja ikonas krāsu nevar nolasīt). */
const RED_TEXT_RE =
  /prohibition|periodic\s+inspection\s+not\s+performed|deregistrat|due\s+to\s+a\s+damage|reregistration\s+abroad|decommission|stolen|theft|k[aä]ytt[oö]kielto|ajokielto|katsastamatta|varastettu/i;

/**
 * Lapas izvilkums (no pārlūka) -> strukturēti dati. Maksas sekcijas izmet, tukšas rindas izmet.
 * raw: { title, banners:[string], summary:[[label,value]], remarks:[{text, tone}], source, sections:[{title, rows:[[l,v]]}] }
 * Atgriež: { vehicleTitle, banners, summary, flags:[{level:"red"|"yellow", text}], source, sections:[{title, rows}] }
 */
export function buildTraficomData(raw, secrets = []) {
  const flags = [];
  const seenFlag = new Set();
  const pushFlag = (text, toneRaw) => {
    const t = clean(redact(text, secrets), 300);
    if (!t || isFeeText(t) || seenFlag.has(t.toLowerCase())) return;
    seenFlag.add(t.toLowerCase());
    const tone = toneOf(toneRaw) || (RED_TEXT_RE.test(t) ? "red" : "yellow");
    flags.push({ level: tone === "red" ? "red" : "yellow", text: t });
  };
  const banners = (raw?.banners ?? []).map((b) => clean(redact(b, secrets), 300)).filter(Boolean);
  for (const b of banners) pushFlag(b, "red");
  for (const r of raw?.remarks ?? []) pushFlag(r?.text, r?.tone);
  const sections = [];
  for (const s of raw?.sections ?? []) {
    const title = clean(s?.title, 160);
    if (!title || isFeeSectionTitle(title)) continue;
    const rows = cleanRows(s?.rows, secrets);
    if (rows.length) sections.push({ title, rows });
  }
  return {
    vehicleTitle: clean(redact(raw?.title, secrets), 200),
    banners,
    summary: cleanRows(raw?.summary, secrets),
    flags: flags.slice(0, 40),
    source: clean(raw?.source, 120),
    sections: sections.slice(0, 30),
  };
}

/** Vai ir kaut kas nolasīts (ne tukša lapa). */
export function traficomDataHasContent(data) {
  return Boolean(data && ((data.summary ?? []).length || (data.sections ?? []).length || (data.flags ?? []).length));
}

/**
 * Teksta kopija formātā, ko lasa PROVIN `lib/traficom-report-parse.ts` (tas pats parseris kā Traficom PDF / ielīmējumam):
 * "Label Value" vienā rindā; "Tax status" un "Restrictions" kā virsraksti ar rindām zem tiem.
 */
export function buildTraficomRawText(data) {
  if (!data) return "";
  const lines = ["Vehicle information"];
  if (data.vehicleTitle) lines.push(data.vehicleTitle);
  for (const b of data.banners ?? []) lines.push(b);
  const summary = data.summary ?? [];
  const tax = summary.filter(([l]) => /^tax\s+status$/i.test(l));
  for (const [label, value] of summary) {
    if (/^tax\s+status$/i.test(label)) continue;
    lines.push(`${label} ${value}`);
  }
  if (tax.length) {
    lines.push("Tax status");
    for (const [, value] of tax) for (const part of value.split(/\s*(?:\/|\n|;)\s*/)) if (part.trim()) lines.push(part.trim());
  }
  const remarks = (data.flags ?? []).filter((f) => !(data.banners ?? []).includes(f.text));
  if (remarks.length) {
    lines.push("Restrictions");
    for (const f of remarks) lines.push(f.text);
  }
  for (const s of data.sections ?? []) {
    lines.push(s.title);
    for (const [label, value] of s.rows) lines.push(`${label} ${value}`);
  }
  if (data.source) lines.push(data.source);
  lines.push("Finnish Transport and Communications Agency");
  return lines.join("\n").slice(0, 60_000);
}
