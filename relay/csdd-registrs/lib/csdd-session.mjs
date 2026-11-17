/**
 * CSDD TTR (ows.csdd.gov.lv:7775) sesija reģistra nolasījumam. TIKAI LASĪŠANA, kā Aivara export-pien.js:
 * pieslēgšanās (#vards/#parole), DZA firmas izvēle (select[name=kiest_id] 5092 + "Turpināt"), atskaite ex('rep_lapt_tl'),
 * ķeksis #lapt_veids (pieņemti tirdzniecībā), #iskaits, meklēšanas poga, lapošana ex('rep_lapt_tl',1,'porcijas_numurs=N').
 *
 * Lapā izsauc TIKAI `rep_lapt_tl` (ALLOWED_EX). Tīklā meklēšanas POST atļauj readonly-guard (csddBaseUrl), viss cits bloķēts.
 * Testi: lib/csdd-registrs-relay.test.ts (ar CSDD imitāciju).
 */

import { existsSync, readFileSync } from "node:fs";
import { CSDD_SEARCH_ACTION, safeClick } from "./readonly-guard.mjs";

export const DZA_KIEST_ID = "5092";

/** Vienīgās lapas darbības (ex): atskaites atvēršana un lapošana. */
export const ALLOWED_EX = new Set([CSDD_SEARCH_ACTION, `${CSDD_SEARCH_ACTION}|1|porcijas_numurs`]);

function exKey(action, arg, params) {
  if (arg == null) return action;
  return `${action}|${arg}|${String(params || "").replace(/=\d+$/, "")}`;
}

/**
 * Piekļuve no faila: KEY=VALUE (userVar/passVar) vai Aivara formāts (1. rinda lietotājs, 2. rinda parole).
 * Vērtības nekad netiek logotas. Atgriež null, ja nav.
 */
export function readCredentialFile(file, userVar = "CSDD_USER", passVar = "CSDD_PASS") {
  if (!file || !existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const kv = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) kv[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  if (kv[userVar] && kv[passVar]) return { user: kv[userVar], pass: kv[passVar] };
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2 && !lines[0].includes("=")) return { user: lines[0], pass: lines[1] };
  return null;
}

/**
 * Divas pieslēgšanās: IRISS (CSDD_TTR_ENV_FILE) un DZA (CSDD_TTR_ENV_FILE_DZA, firma kiest_id 5092).
 * @param {"IRISS" | "DZA"} owner
 * @param {Record<string, string | undefined>} env
 */
export function ownerLogin(owner, env) {
  const userVar = env.CSDD_USER_VAR || "CSDD_USER";
  const passVar = env.CSDD_PASS_VAR || "CSDD_PASS";
  if (owner === "DZA") {
    const file = env.CSDD_TTR_ENV_FILE_DZA || "/root/iriss-ttr/creds-autoapkope-dza";
    return { owner, file, envName: "CSDD_TTR_ENV_FILE_DZA", kiestId: env.REGISTRS_DZA_KIEST_ID || DZA_KIEST_ID, userVar, passVar };
  }
  const file = env.CSDD_TTR_ENV_FILE || "/root/iriss-ttr/.env";
  return { owner, file, envName: "CSDD_TTR_ENV_FILE", kiestId: "", userVar, passVar };
}

/** Playwright operācijas (vienīgais ceļš uz lapu). Testos aizstāj ar CSDD imitāciju. */
export function playwrightOps(page, timeout = 90000) {
  return {
    goto: (url) => page.goto(url, { waitUntil: "networkidle", timeout }),
    waitJx: () => page.waitForFunction(() => window.activejxRequestCount === 0, null, { timeout }),
    has: async (sel) => (await page.$(sel)) !== null,
    fill: (sel, v) => page.fill(sel, v),
    select: (sel, v) => page.selectOption(sel, v),
    options: (sel) => page.evaluate((s) => [...document.querySelectorAll(`${s} option`)].map((o) => o.value), sel),
    check: (sel) => page.check(sel),
    /** "Visas" (tukša vērtība) vietai/glabāšanas vietai, ja tāda ir - tikai DOM vērtība, bez pieprasījuma. */
    resetSelect: (name) =>
      page.evaluate((n) => {
        const s = document.querySelector(`select[name=${n}]`);
        if (s && [...s.options].some((o) => o.value === "")) s.value = "";
      }, name),
    callEx: (action, arg, params) =>
      page.evaluate(([a, b, c]) => {
        return b == null ? ex(a) : ex(a, b, c);
      }, [action, arg == null ? null : arg, params == null ? null : params]),
    click: (sel, phase) => safeClick(page.locator(sel).first(), phase),
    p1Html: () => page.evaluate(() => (document.getElementById("p1") || document.body).innerHTML),
    tables: () =>
      page.evaluate(() => {
        const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
        const root = document.getElementById("p1") || document;
        return [...root.querySelectorAll("table")]
          .map((t) => {
            const rows = [...t.querySelectorAll("tr")];
            if (rows.length < 2) return null;
            const headRow = t.querySelector("thead tr") || rows.find((r) => r.querySelector("th")) || rows[0];
            const headers = [...headRow.querySelectorAll("th,td")].map((c) => clean(c.innerText));
            const body = rows.filter((r) => r !== headRow).map((r) => [...r.querySelectorAll("td")].map((c) => clean(c.innerText)));
            return { headers, rows: body.filter((r) => r.length >= 2) };
          })
          .filter(Boolean);
      }),
  };
}

async function ex(ops, action, arg, params) {
  const key = exKey(action, arg, params);
  if (!ALLOWED_EX.has(key)) throw new Error(`csdd_action_not_allowed:${key}`);
  await ops.callEx(action, arg, params);
  await ops.waitJx();
}

/**
 * Pieslēgšanās + (DZA) firmas izvēle. Guard paliek "login" fāzē; pēc tam izsaucējs pārslēdz uz "read".
 * @param {ReturnType<typeof playwrightOps>} ops
 * @param {ReturnType<typeof ownerLogin>} who
 */
export async function loginCsdd(ops, who, { baseUrl, log = () => {} }) {
  await ops.goto(`${baseUrl.replace(/\/$/, "")}/`);
  if (await ops.has("#vards")) {
    const cred = readCredentialFile(who.file, who.userVar, who.passVar);
    if (!cred) throw new Error(`csdd_credentials_missing_${who.owner} (${who.envName})`);
    await ops.fill("#vards", cred.user);
    await ops.fill("#parole", cred.pass);
    await ops.click("button[name=submit]", "login");
    await ops.waitJx();
    if (await ops.has("#vards")) throw new Error(`csdd_login_failed_${who.owner}`);
  }
  const choosing = await ops.has("select[name=kiest_id]");
  if (who.kiestId) {
    // Kopīgais DZA/Autoapkope logins: firmu izvēlas vienreiz sesijā. Bez izvēles nezinām, kuras firmas saraksts - stop.
    if (!choosing) throw new Error(`csdd_company_choice_missing_${who.owner}`);
    if (!(await ops.options("select[name=kiest_id]")).includes(who.kiestId)) throw new Error(`csdd_company_${who.kiestId}_missing`);
    await ops.select("select[name=kiest_id]", who.kiestId);
    await ops.click("button[name=submit]", "login");
    await ops.waitJx();
    if (await ops.has("select[name=kiest_id]")) throw new Error(`csdd_company_choice_failed_${who.owner}`);
  } else if (choosing) {
    throw new Error(`csdd_unexpected_company_choice_${who.owner}`);
  }
  log(`pieslēgts ${who.owner}`);
}

/**
 * Pieņemto auto saraksts (tirdzniecības atskaite ar #lapt_veids). Atgriež lapas parse-registry formātā.
 * @param {ReturnType<typeof playwrightOps>} ops
 */
export async function readTradeReport(ops, { owner, maxPages = 20, pageSize = "1000", isLost = () => false }) {
  await ex(ops, CSDD_SEARCH_ACTION);
  if (!(await ops.has("#lapt_veids"))) throw new Error(`csdd_report_form_missing_${owner}`);
  for (const n of ["lra_id", "gliet_id"]) await ops.resetSelect(n);
  await ops.check("#lapt_veids");
  if (await ops.has("#iskaits")) await ops.fill("#iskaits", pageSize);
  await ops.click("#p1 button[type=submit]", "search");
  await ops.waitJx();
  const pages = [];
  const seen = new Set();
  for (let p = 1; p <= maxPages; p++) {
    if (isLost()) throw new Error("vpn_lost");
    if (p > 1) await ex(ops, CSDD_SEARCH_ACTION, 1, `porcijas_numurs=${p}`);
    const tables = await ops.tables();
    const sig = tables.flatMap((t) => t.rows.map((r) => r.join("\t")));
    const fresh = sig.filter((r) => !seen.has(r));
    if (p > 1 && fresh.length === 0) break;
    sig.forEach((r) => seen.add(r));
    pages.push({ owner, tables });
    if (!/porcijas_numurs/.test(await ops.p1Html())) break;
  }
  return pages;
}
