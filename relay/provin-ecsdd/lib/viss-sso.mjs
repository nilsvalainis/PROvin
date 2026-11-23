/**
 * Vienotā pieteikšanās (VISS, vpm.viss.gov.lv; agrāk latvija.lv) ar Smart-ID - kopīgs LTAB un e.csdd relejiem.
 * Fails ir IDENTISKS abos relejos (`relay/provin-ltab/lib/viss-sso.mjs` un `relay/provin-ecsdd/lib/viss-sso.mjs`),
 * jo katrs relejs tiek izvietots atsevišķi. Tests pārbauda, ka abas kopijas sakrīt.
 *
 * Plūsma (pārbaudīts 23.11.2026, bez pieteikšanās):
 *  1. vpm.viss.gov.lv/LVP.STS/Account/Login - ķeksītis name="agree" ("Piekrītu identifikācijas veikšanas noteikumiem...")
 *     + metožu pogas `a.js--vpm-auth-button` (data-url ...External/Challenge?scheme=smartid | mobile | eid | banka ...).
 *  2. vpm.viss.gov.lv/VPM.IdP.SmartId/Account/SmartIdAuthentication ("Smart-ID autentifikācijas adapteris"):
 *     QR kods (device link) + forma "Saņemt paziņojumu Smart-ID lietotnē": #identity-number (placeholder xxxxxx-xxxxx,
 *     pieņem ar/bez defises), poga #ok "Autentificēties", "Atcelt". Forma tiek iesniegta ar fetch un pēc tam
 *     location.replace uz koda lapu. Nezināms personas kods -> tā pati forma ar "Lietotājam nav konta Smart-ID sistēmā".
 *  3. Koda lapa (tajā pašā adapterī, bez personas koda lauka) rāda 4 ciparu kontrolkodu; teksts vēl nav redzēts,
 *     tāpēc kods tiek meklēts gan pēc etiķetes, gan kā atsevišķs 4 ciparu elements. Ja kodu nevar nolasīt,
 *     relejs tik un tā paziņo "apstiprini Smart-ID" (bez koda) un gaida apstiprinājumu.
 *  4. Pēc apstiprinājuma: wsfed callback -> atpakaļ uz pakalpojumu (services.ltab.lv / e.csdd.lv).
 *
 * Drošība: personas kods tikai `locator.fill`; teksts pirms jebkādas apstrādes/atkļūdošanas tiek redaktēts.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Vienotā pieteikšanās: vpm.viss.gov.lv (2026) un vecais latvija.lv. */
export function isSsoHost(host) {
  const h = String(host ?? "").toLowerCase();
  return (
    h === "viss.gov.lv" ||
    h.endsWith(".viss.gov.lv") ||
    h === "latvija.lv" ||
    h.endsWith(".latvija.lv") ||
    h === "latvija.gov.lv" ||
    h.endsWith(".latvija.gov.lv")
  );
}

/** Personas kods formātā, ko prasa VISS lauks: xxxxxx-xxxxx (ievada arī bez defises). */
export function normalizePersonalCode(raw) {
  const t = String(raw ?? "").trim();
  const digits = t.replace(/\D/g, "");
  return digits.length === 11 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : t;
}

/** Personas kodi (ar/bez defises) un dotie noslēpumi -> `***`. */
export function redactSso(text, secrets = []) {
  let out = String(text ?? "");
  for (const s of secrets) {
    const v = String(s ?? "").trim();
    if (v.length >= 6) out = out.split(v).join("***");
    const digits = v.replace(/\D/g, "");
    if (digits.length === 11) {
      out = out.split(digits).join("***");
      out = out.split(`${digits.slice(0, 6)}-${digits.slice(6)}`).join("***");
    }
  }
  return out.replace(/\b\d{6}-?\d{5}\b/g, "***");
}

const SMARTID_RE = /smart[\s-]?id/i;
const ADAPTER_TEXT_RE = /smart[\s-]?id\s+(autentifik\p{L}*\s+adapter|authentication\s+adapter)/iu;
const CODE_LABEL_RE =
  /(kontrol\p{L}*|verifik\p{L}*|verific\p{L}*|control|dro[sš][iī]bas|p[aā]rbaudes|apstiprin[aā]juma|security)\s*(kods|kodu|koda|code)\D{0,60}?(?<!\d)(\d{4})(?!\d)/iu;
const CODE_PLAIN_RE = /\b(kods|code)\s*(ir|is)?\s*[:\-–]?\s*(?<!\d)(\d{4})(?!\d)/iu;
const SSO_FAIL_RE =
  /atcelts|atteikts|atteic|atc[eē]la|noilg|neizdev[aā]s\s+(pieteikties|autentific)|beidzies\s+laiks|refused|timed?\s*out|canceled|cancelled/i;
// Personas koda forma ar kļūdu (pēc iesniegšanas). QR (device link) termiņa beigas NAV kļūda - tā attiecas tikai uz QR.
const NO_ACCOUNT_RE =
  /nav\s+konta\s+smart[\s-]?id|no\s+smart[\s-]?id\s+account|account\s+not\s+found|neder[iī]gs\s+personas\s+koda|invalid\s+(personal|national)\s+(code|identi)/i;

export function looksLikeSsoFailure(text) {
  const t = String(text ?? "");
  return SSO_FAIL_RE.test(t) || NO_ACCOUNT_RE.test(t);
}

/** Vai šī ir VISS Smart-ID adaptera lapa (personas koda forma vai koda gaidīšana). */
export function isSmartIdAdapter(snap) {
  return Boolean(snap?.smartIdAdapter) || /\/vpm\.idp\.smartid\//i.test(String(snap?.path ?? "")) || ADAPTER_TEXT_RE.test(String(snap?.text ?? ""));
}

/**
 * 4 ciparu Smart-ID kontrolkods (vai `null`).
 * 1) teksts ar etiķeti ("Kontrolkods: 1234", "Verification code 1234"); 2) elementi ar code/verif/kods id/klasē;
 * 3) `digitCandidates` - atsevišķi 4 ciparu elementi (tikai adaptera lapā; jābūt tieši vienai vērtībai).
 */
export function extractVerificationCode(text, candidates = [], digitCandidates = []) {
  const t = redactSso(String(text ?? "")).replace(/\s+/g, " ");
  const m = t.match(CODE_LABEL_RE) || t.match(CODE_PLAIN_RE);
  if (m) return m[m.length - 1];
  for (const c of candidates ?? []) {
    const v = String(c ?? "").replace(/\s+/g, "");
    if (/^\d{4}$/.test(v)) return v;
  }
  const uniq = [...new Set((digitCandidates ?? []).map((c) => String(c ?? "").replace(/\s+/g, "")).filter((v) => /^\d{4}$/.test(v)))];
  return uniq.length === 1 ? uniq[0] : null;
}

/** Kods no snapshot (digitCandidates tikai Smart-ID adaptera lapā). */
export function codeFromSnapshot(snap) {
  return extractVerificationCode(snap?.text, snap?.codeCandidates, isSmartIdAdapter(snap) ? snap?.digitCandidates : []);
}

/**
 * SSO lapas veids. snapshot: { host, path, text, inputs:[{label,type,id,visible}], buttons:[{text,visible}],
 *   hasAgree, smartIdChoice, smartIdAdapter, codeCandidates, digitCandidates }
 * Atgriež: sso_wait (kods redzams vai adapteris gaida telefonu) | sso_code_input | sso_choose | sso_failed | unknown
 */
export function classifySso(snap) {
  const text = String(snap?.text ?? "");
  const inputs = (snap?.inputs ?? []).filter((i) => i.visible !== false);
  const buttons = (snap?.buttons ?? []).filter((b) => b.visible !== false);
  if (codeFromSnapshot(snap)) return "sso_wait";
  if (NO_ACCOUNT_RE.test(text)) return "sso_failed";
  const codeInput = inputs.some(
    (i) =>
      i.id === "identity-number" ||
      (/text|tel|number|^$/.test(String(i.type ?? "")) && /personas\s*kod|identity|isikukood|xxxxxx|national/i.test(String(i.label ?? ""))),
  );
  if (codeInput) return "sso_code_input";
  if (snap?.hasAgree || snap?.smartIdChoice) return "sso_choose";
  if (looksLikeSsoFailure(text)) return "sso_failed";
  // Adapteris bez personas koda lauka = koda lapa (kods var parādīties ar nokavēšanos).
  if (isSmartIdAdapter(snap)) return "sso_wait";
  if (buttons.some((b) => SMARTID_RE.test(b.text)) || SMARTID_RE.test(text)) return "sso_choose";
  return "unknown";
}

/**
 * Pārlūkā (page.evaluate): VISS papildu lauki snapshot vajadzībām. Funkcijai jābūt pašpietiekamai.
 */
export function collectSsoExtras() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  };
  const digits = (el) => (el.textContent || "").replace(/\s+/g, "");
  const codeCandidates = [
    ...document.querySelectorAll('[id*="code" i], [class*="code" i], [id*="verif" i], [class*="verif" i], [class*="kods" i], [id*="kods" i]'),
  ]
    .filter(vis)
    .map(digits)
    .filter((t) => /^\d{4}$/.test(t))
    .slice(0, 5);
  const digitCandidates = [...document.querySelectorAll("body *")]
    .filter((el) => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName))
    .filter((el) => /^\d{4}$/.test(digits(el)) && vis(el))
    .map(digits)
    .slice(0, 10);
  return {
    path: location.pathname,
    hasAgree: Boolean(document.querySelector('input[type="checkbox"][name="agree"]')),
    smartIdChoice: Boolean(document.querySelector('.js--vpm-auth-button[data-url*="scheme=smartid" i]')),
    smartIdAdapter: /\/vpm\.idp\.smartid\//i.test(location.pathname),
    codeCandidates,
    digitCandidates,
  };
}

const CANCEL_RE = /atcelt|atteikties|cancel|iziet|logout/i;

async function clickVisibleByText(page, re, { exclude } = {}) {
  const candidates = page.locator('button, input[type="submit"], input[type="button"], a');
  const n = await candidates.count();
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const text = ((await el.textContent().catch(() => "")) || (await el.getAttribute("value").catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (!re.test(text) || CANCEL_RE.test(text) || /apmaks|samaks|maks[aā]jum/i.test(text)) continue;
    if (exclude && exclude.test(text)) continue;
    await el.click();
    return true;
  }
  return false;
}

/** Metodes izvēle: ķeksītis "Piekrītu..." + Smart-ID. Atgriež false, ja Smart-ID izvēles nav. */
export async function chooseSmartId(page) {
  const agree = page.locator('input[type="checkbox"][name="agree"]').first();
  if ((await agree.count()) && !(await agree.isChecked().catch(() => true))) {
    await agree.check({ force: true }).catch(async () => {
      const id = await agree.getAttribute("id");
      if (id) await page.locator(`label[for="${id}"]`).click();
    });
    await sleep(800);
  }
  const smartId = page.locator('.js--vpm-auth-button[data-url*="scheme=smartid" i]').first();
  if (await smartId.count()) {
    await smartId.click();
  } else if (!(await clickVisibleByText(page, /smart[\s-]?id/i, { exclude: /lietotn|app\b/i }))) {
    return false;
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await sleep(1500);
  return true;
}

/** Personas koda forma: ievada kodu (xxxxxx-xxxxx) un nospiež "Autentificēties". false, ja lauka nav. */
export async function submitPersonalCode(page, personalCode) {
  let input = page.locator("#identity-number");
  if (!(await input.count())) input = page.locator('input[type="text"], input[type="tel"], input[type="number"], input:not([type])').first();
  if (!(await input.isVisible().catch(() => false))) return false;
  await input.fill(normalizePersonalCode(personalCode));
  // Valsts izvēle vecajā latvija.lv formā (ja ir): Latvija.
  const country = page.locator("select").first();
  if (await country.isVisible().catch(() => false)) {
    await country.selectOption({ label: "Latvija" }).catch(() => country.selectOption({ value: "LV" }).catch(() => undefined));
  }
  const ok = page.locator("#ok");
  if (await ok.isVisible().catch(() => false)) await ok.click();
  else if (!(await clickVisibleByText(page, /autentific|turpin[aā]t|pieteikties|ien[aā]kt|t[aā]l[aā]k|apstiprin[aā]t|n[aā]kamais|continue|submit/i)))
    await page.keyboard.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await sleep(2500);
  return true;
}

/**
 * Gaida Smart-ID apstiprinājumu telefonā.
 * snapshotFn(page) -> snapshot; onCode(code|null) tiek izsaukts vienreiz (ja `codeAlreadySent` nav true).
 * Atgriež: { status: "left" } (pārlūks atpakaļ pakalpojumā) | "refused" | "timeout" | "continue" (nospiests "Turpināt"),
 *          kā arī { codeSent }.
 */
export async function waitForSmartId(page, { snapshotFn, onCode, codeAlreadySent = false, timeoutMs = 120_000, codeWaitMs = 15_000 }) {
  const onSso = () => {
    try {
      return isSsoHost(new URL(page.url()).hostname);
    } catch {
      return false;
    }
  };
  const readText = () => page.evaluate(() => document.body?.innerText || "").catch(() => "");
  let codeSent = codeAlreadySent;
  if (!codeSent) {
    let code = null;
    const codeDeadline = Date.now() + codeWaitMs;
    while (onSso()) {
      const snap = await snapshotFn(page).catch(() => null);
      if (snap && looksLikeSsoFailure(snap.text) && !snap.hasAgree) return { status: "refused", codeSent };
      code = snap ? codeFromSnapshot(snap) : null;
      if (code || Date.now() >= codeDeadline) break;
      await sleep(1000);
    }
    codeSent = true;
    await onCode(code);
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!onSso()) return { status: "left", codeSent };
    if (looksLikeSsoFailure(await readText())) return { status: "refused", codeSent };
    await sleep(2000);
  }
  if (!onSso()) return { status: "left", codeSent };
  // Pēc apstiprinājuma SSO var prasīt vēl vienu "Turpināt" / "Piekrītu".
  const after = await snapshotFn(page).catch(() => null);
  if (after && !codeFromSnapshot(after) && (await clickVisibleByText(page, /turpin[aā]t|piekr[iī]tu|apstiprin[aā]t|continue/i))) {
    return { status: "continue", codeSent };
  }
  return { status: "timeout", codeSent };
}
