/**
 * CSDD tirdzniecības reģistrs: TIKAI LASĪŠANA.
 * Šis modulis ir vienīgais veids, kā skripts drīkst runāt ar reģistru:
 * - tīkla līmenī: atļauti tikai GET/HEAD; POST tikai (a) pieslēgšanās fāzē - pieslēgšanās / firmas izvēles forma,
 *   (b) lasīšanas fāzē - TIKAI CSDD tirdzniecības atskaites meklēšana `rep_lapt_tl` (whitelist), bez rakstošiem vārdiem;
 * - UI līmenī: nekad nespiež pogas/saites ar rakstošu nozīmi (saglabāt, atcelt, anulēt, dzēst, apstiprināt...);
 * - pārlūka dialogi (confirm/alert) vienmēr tiek noraidīti.
 * Testi: lib/csdd-registrs-relay.test.ts (vitest) un relay/csdd-registrs/lib/*.test.mjs.
 */

/** Vārdi, kas nozīmē rakstošu darbību. Elementu ar tādu tekstu/vērtību/id skripts nekad nespiež. */
export const FORBIDDEN_ACTION_RE =
  /saglab|atcel|anul|dzēs|dzes|apstiprin|iesniegt|iesūt|iesut|reģistrēt|registret|noņem|nonem|izņem|iznem|paraksti|pārdot|pardot|nodot|labot|rediģ|redig|pievienot|izveidot|mainīt|mainit|save|delete|remove|cancel|confirm|submit|approve|update|insert|create|sign/i;

/** Pieslēgšanās pogas, ko drīkst spiest TIKAI pieslēgšanās fāzē. */
export const LOGIN_ACTION_RE = /ienākt|ienakt|pieslēgt|pieslegt|autorizēt|autorizet|log\s*in|sign\s*in/i;

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Vienīgā CSDD lasīšanas POST darbība: tirdzniecības atskaite (saraksts, meklēšana, lapošana porcijas_numurs). */
export const CSDD_SEARCH_ACTION = "rep_lapt_tl";
const CSDD_SEARCH_RE = new RegExp(`(^|[^A-Za-z0-9_])${CSDD_SEARCH_ACTION}([^A-Za-z0-9_]|$)`);
/** CSDD pieslēgšanās (#vards/#parole) un firmas izvēles (kiest_id) formas lauki. */
const CSDD_LOGIN_BODY_RE = /(^|&)(vards|kiest_id)=/;

function sameOrigin(url, baseUrl) {
  if (!baseUrl) return false;
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Vai tīkla pieprasījums ir atļauts.
 * @param {{ method: string, url: string, postData?: string | null }} req
 * @param {{ phase: "login" | "read", loginPostRe?: RegExp | null, readPostRe?: RegExp | null, csddBaseUrl?: string | null }} policy
 *   csddBaseUrl - CSDD TTR adrese: ieslēdz CSDD pieslēgšanās POST un meklēšanas `rep_lapt_tl` POST (tikai šajā origin).
 * @returns {{ allowed: boolean, reason: string }}
 */
export function isAllowedRequest(req, policy) {
  const method = String(req.method || "GET").toUpperCase();
  if (READ_METHODS.has(method)) return { allowed: true, reason: "read_method" };
  if (method !== "POST") return { allowed: false, reason: `method_${method}` };
  const url = String(req.url || "");
  const body = String(req.postData || "");
  const query = decodeSafe(url.split("?")[1] || "");
  const csdd = sameOrigin(url, policy.csddBaseUrl);
  if (policy.phase === "login") {
    if (policy.loginPostRe && policy.loginPostRe.test(url)) return { allowed: true, reason: "login_post" };
    // CSDD: pieslēgšanās un firmas izvēle (DZA kiest_id). Saturu (paroli) nekad nelogo un nepārbauda pret vārdiem.
    if (csdd && CSDD_LOGIN_BODY_RE.test(body) && !CSDD_SEARCH_RE.test(query)) return { allowed: true, reason: "csdd_login_post" };
    return { allowed: false, reason: "post_blocked" };
  }
  if (policy.phase !== "read") return { allowed: false, reason: "post_blocked" };
  const readPost = (csdd && (CSDD_SEARCH_RE.test(query) || CSDD_SEARCH_RE.test(decodeSafe(body)))) || (policy.readPostRe && policy.readPostRe.test(url));
  if (!readPost) return { allowed: false, reason: "post_blocked" };
  // Arī atļautā meklēšana - bez rakstošas darbības vārdiem pieprasījumā.
  if (FORBIDDEN_ACTION_RE.test(decodeSafe(body)) || FORBIDDEN_ACTION_RE.test(query)) return { allowed: false, reason: "post_forbidden_action" };
  return { allowed: true, reason: csdd ? "csdd_search_post" : "read_post_allowlisted" };
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/**
 * Vai elementu drīkst spiest. Skatās redzamo tekstu, value, id, name, title, aria-label, onclick un href.
 * @param {{ text?: string, value?: string, id?: string, name?: string, title?: string, ariaLabel?: string, onclick?: string, href?: string, tag?: string, type?: string, inLoginForm?: boolean, inCompanyForm?: boolean, inSearchForm?: boolean }} el
 * @param {"login" | "read" | "search"} phase
 */
export function isClickAllowed(el, phase) {
  const parts = [el.text, el.value, el.id, el.name, el.title, el.ariaLabel, el.onclick, el.href].filter(Boolean).join(" ");
  const visible = [el.text, el.value, el.title, el.ariaLabel].filter(Boolean).join(" ");
  const tag = String(el.tag || "").toLowerCase();
  const type = String(el.type || "").toLowerCase();
  const formButton = (tag === "button" || tag === "input") && (type === "submit" || type === "button" || type === "");
  if (phase === "login" && LOGIN_ACTION_RE.test(parts) && !FORBIDDEN_ACTION_RE.test(parts.replace(LOGIN_ACTION_RE, ""))) {
    return { allowed: true, reason: "login_button" };
  }
  // CSDD: pieslēgšanās formas (ar paroles lauku) vai firmas izvēles (kiest_id) poga ("Turpināt", name=submit).
  const cleanAction = !FORBIDDEN_ACTION_RE.test(visible) && !FORBIDDEN_ACTION_RE.test(String(el.onclick || ""));
  if (phase === "login" && formButton && (el.inLoginForm || el.inCompanyForm) && cleanAction) {
    return { allowed: true, reason: "csdd_login_form" };
  }
  // CSDD: tikai tirdzniecības atskaites meklēšanas formas (ar #lapt_veids) poga.
  if (phase === "search") {
    if (formButton && el.inSearchForm && cleanAction) return { allowed: true, reason: "csdd_search_form" };
    return { allowed: false, reason: "not_search_button" };
  }
  if (FORBIDDEN_ACTION_RE.test(parts)) return { allowed: false, reason: "forbidden_label" };
  // Lasīšanas fāzē: tikai saites ar href (GET navigācija). Formu pogas (submit) nekad.
  if (phase === "read") {
    if (tag === "a" && el.href && !/^javascript:/i.test(el.href)) return { allowed: true, reason: "link" };
    return { allowed: false, reason: `read_phase_${tag || "unknown"}${type ? `_${type}` : ""}` };
  }
  return { allowed: false, reason: "not_login_button" };
}

/**
 * Uzliek aizsardzību Playwright lapai/kontekstam. Atgriež objektu ar `setPhase` un bloķēto pieprasījumu žurnālu.
 * @param {import("playwright").BrowserContext} context
 * @param {{ loginPostRe?: RegExp | null, readPostRe?: RegExp | null, csddBaseUrl?: string | null, log?: (msg: string) => void }} opts
 */
export async function installReadOnlyGuard(context, opts = {}) {
  const state = { phase: /** @type {"login" | "read"} */ ("login"), blocked: /** @type {string[]} */ ([]) };
  const log = opts.log ?? (() => {});
  await context.route("**/*", async (route) => {
    const r = route.request();
    const verdict = isAllowedRequest(
      { method: r.method(), url: r.url(), postData: r.postData() },
      { phase: state.phase, loginPostRe: opts.loginPostRe ?? null, readPostRe: opts.readPostRe ?? null, csddBaseUrl: opts.csddBaseUrl ?? null },
    );
    if (verdict.allowed) return route.continue();
    const entry = `${r.method()} ${r.url().split("?")[0]} (${verdict.reason})`;
    state.blocked.push(entry);
    log(`BLOĶĒTS: ${entry}`);
    return route.abort("blockedbyclient");
  });
  context.on("page", (page) => attachDialogGuard(page, log));
  for (const page of context.pages()) attachDialogGuard(page, log);
  return {
    setPhase(phase) {
      state.phase = phase;
    },
    get phase() {
      return state.phase;
    },
    get blocked() {
      return [...state.blocked];
    },
  };
}

function attachDialogGuard(page, log) {
  page.on("dialog", (d) => {
    log(`dialogs noraidīts: ${d.type()}`);
    d.dismiss().catch(() => {});
  });
}

/**
 * Droša klikšķināšana: pirms klikšķa nolasa elementa atribūtus un pārbauda `isClickAllowed`.
 * Aizliegtu elementu nespiež un met kļūdu (skripts apstājas).
 * @param {import("playwright").Locator} locator
 * @param {"login" | "read" | "search"} phase
 */
export async function safeClick(locator, phase) {
  const el = await locator.evaluate((node) => ({
    tag: node.tagName,
    type: node.getAttribute("type") || "",
    text: (node.textContent || "").trim().slice(0, 200),
    value: node.getAttribute("value") || "",
    id: node.id || "",
    name: node.getAttribute("name") || "",
    title: node.getAttribute("title") || "",
    ariaLabel: node.getAttribute("aria-label") || "",
    onclick: node.getAttribute("onclick") || "",
    href: node.getAttribute("href") || "",
    inLoginForm: Boolean(node.form && node.form.querySelector("input[type=password]")),
    inCompanyForm: Boolean(node.form && node.form.querySelector("select[name=kiest_id]")),
    inSearchForm: Boolean(node.form && node.form.querySelector("#lapt_veids")),
  }));
  const verdict = isClickAllowed(el, phase);
  if (!verdict.allowed) throw new Error(`readonly_guard_click_refused:${verdict.reason}`);
  await locator.click();
}
