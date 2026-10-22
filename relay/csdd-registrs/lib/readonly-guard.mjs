/**
 * CSDD tirdzniecības reģistrs: TIKAI LASĪŠANA.
 * Šis modulis ir vienīgais veids, kā skripts drīkst runāt ar reģistru:
 * - tīkla līmenī: atļauti tikai GET/HEAD (un POST tikai pieslēgšanās fāzē uz pieslēgšanās adresi);
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

/**
 * Vai tīkla pieprasījums ir atļauts.
 * @param {{ method: string, url: string, postData?: string | null }} req
 * @param {{ phase: "login" | "read", loginPostRe?: RegExp | null, readPostRe?: RegExp | null }} policy
 * @returns {{ allowed: boolean, reason: string }}
 */
export function isAllowedRequest(req, policy) {
  const method = String(req.method || "GET").toUpperCase();
  if (READ_METHODS.has(method)) return { allowed: true, reason: "read_method" };
  if (method !== "POST") return { allowed: false, reason: `method_${method}` };
  const url = String(req.url || "");
  const body = String(req.postData || "");
  if (policy.phase === "login" && policy.loginPostRe && policy.loginPostRe.test(url)) {
    return { allowed: true, reason: "login_post" };
  }
  // Tikai skaidri atļauts meklēšanas (lasīšanas) POST, un arī tad - bez rakstošas darbības vārdiem pieprasījumā.
  if (policy.phase === "read" && policy.readPostRe && policy.readPostRe.test(url)) {
    if (FORBIDDEN_ACTION_RE.test(decodeSafe(body)) || FORBIDDEN_ACTION_RE.test(decodeSafe(url.split("?")[1] || ""))) {
      return { allowed: false, reason: "post_forbidden_action" };
    }
    return { allowed: true, reason: "read_post_allowlisted" };
  }
  return { allowed: false, reason: "post_blocked" };
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
 * @param {{ text?: string, value?: string, id?: string, name?: string, title?: string, ariaLabel?: string, onclick?: string, href?: string, tag?: string, type?: string }} el
 * @param {"login" | "read"} phase
 */
export function isClickAllowed(el, phase) {
  const parts = [el.text, el.value, el.id, el.name, el.title, el.ariaLabel, el.onclick, el.href].filter(Boolean).join(" ");
  if (phase === "login" && LOGIN_ACTION_RE.test(parts) && !FORBIDDEN_ACTION_RE.test(parts.replace(LOGIN_ACTION_RE, ""))) {
    return { allowed: true, reason: "login_button" };
  }
  if (FORBIDDEN_ACTION_RE.test(parts)) return { allowed: false, reason: "forbidden_label" };
  const tag = String(el.tag || "").toLowerCase();
  const type = String(el.type || "").toLowerCase();
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
 * @param {{ loginPostRe?: RegExp | null, readPostRe?: RegExp | null, log?: (msg: string) => void }} opts
 */
export async function installReadOnlyGuard(context, opts = {}) {
  const state = { phase: /** @type {"login" | "read"} */ ("login"), blocked: /** @type {string[]} */ ([]) };
  const log = opts.log ?? (() => {});
  await context.route("**/*", async (route) => {
    const r = route.request();
    const verdict = isAllowedRequest(
      { method: r.method(), url: r.url(), postData: r.postData() },
      { phase: state.phase, loginPostRe: opts.loginPostRe ?? null, readPostRe: opts.readPostRe ?? null },
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
 * @param {"login" | "read"} phase
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
  }));
  const verdict = isClickAllowed(el, phase);
  if (!verdict.allowed) throw new Error(`readonly_guard_click_refused:${verdict.reason}`);
  await locator.click();
}
