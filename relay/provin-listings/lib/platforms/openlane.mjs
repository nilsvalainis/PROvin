/**
 * Openlane: Cloudflare laiž cauri tikai īstu pārlūku. Sarakstu neparsējam no HTML:
 * pārlūks atver pasūtījuma meklēšanas URL, SPA pats sūta POST /en/findcarv6/search, mēs to
 * pārtveram (body + atbilde), tad nākamās lapas pieprasām no lapas iekšpuses ar to pašu body
 * un mainītu Paging.PageNumber. Tā nav jāmin query / FacetRequest formāts.
 *
 * Sesija beidzas ik pēc pāris stundām. /en/login ir 404: login ir findcar popups
 * (cookie -> #loginButton2 -> input[name=Email] username -> #loginButton4 ->
 * input[name=Password] -> submit #loginButton3; fallback: [class*="Modal-module_modal"]
 * button:has-text("Login")). Captcha / 2FA -> login_required.
 * Sekme: #loginButton2 nav, vai GET /en/myaccount/homev6/CurrentUserDetails atgriež lietotāju.
 * ChassisNumber meklēšanā paliek null arī ielogotam, tāpēc tas NAV login pārbaude.
 * Konta valoda var būt RU; piespiežam /en/ ceļu, lai virsraksti būtu EN.
 */
import { hasCaptchaOrChallenge, looksLikeTwoFactor, pageText, randomPause } from "../browser.mjs";
import { num } from "../items.mjs";
import { dismissCookieBanner, tickRemember } from "../login.mjs";
import {
  CURRENT_USER_PATH,
  LOGGED_OUT_HOST_RE,
  PROBE_URL,
  SEARCH_API_RE,
  mapOpenlaneAuction,
  openlaneEnglishUrl,
  openlaneSessionLooksLoggedIn,
} from "./openlane-logic.mjs";

export {
  coerceOpenlaneMargin,
  mapOpenlaneAuction,
  openlaneCurrentUserShowsLogin,
  openlaneEnglishUrl,
  openlaneSessionLooksLoggedIn,
  pickOpenlaneVatNote,
} from "./openlane-logic.mjs";

export const openlane = {
  id: "openlane",
  label: "Openlane",
  hasCredentials: () => Boolean(process.env.OPENLANE_USER && process.env.OPENLANE_PASS),
  loginUrl: PROBE_URL,
  probeUrl: PROBE_URL,
  isLoggedIn,
  login,
  fetchSource,
};

async function ensureEnglishPath(page) {
  const url = page.url();
  const en = openlaneEnglishUrl(/openlane\.eu/i.test(url) ? url : PROBE_URL);
  if (en && en !== url) {
    await page.goto(en, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
  }
}

async function readCurrentUser(page) {
  return page
    .evaluate(async (path) => {
      try {
        const r = await fetch(path, { credentials: "include", headers: { accept: "application/json" } });
        if (!r.ok) return { ok: false };
        const text = await r.text();
        try {
          return { ok: true, json: JSON.parse(text) };
        } catch {
          return { ok: false };
        }
      } catch {
        return { ok: false };
      }
    }, CURRENT_USER_PATH)
    .catch(() => ({ ok: false }));
}

async function isLoggedIn(page) {
  if (LOGGED_OUT_HOST_RE.test(page.url())) return false;
  await ensureEnglishPath(page);
  if (LOGGED_OUT_HOST_RE.test(page.url())) return false;
  const user = await readCurrentUser(page);
  const loginCount = await page.locator("#loginButton2").count().catch(() => 0);
  const text = await pageText(page, 6_000);
  return openlaneSessionLooksLoggedIn({
    url: page.url(),
    loginButtonPresent: loginCount > 0,
    currentUserJson: user?.ok ? user.json : null,
    pageText: text,
  });
}

async function login(page) {
  const username = process.env.OPENLANE_USER || "";
  const password = process.env.OPENLANE_PASS || "";
  if (!username || !password) return { ok: false, status: "login_required", note: "Openlane: nav lietotāja / paroles env." };
  try {
    await page.goto(openlaneEnglishUrl(PROBE_URL), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(800, 1_600);
    await dismissCookieBanner(page);
    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge) return { ok: false, status: "login_required", note: `Openlane: ${challenge}; jāielogojas manuāli.` };

    await page.locator("#loginButton2").click({ timeout: 15_000 });
    await randomPause(400, 900);
    const email = page.locator('input[name="Email"]').first();
    await email.waitFor({ state: "visible", timeout: 15_000 });
    await email.click();
    await email.fill(username);
    await randomPause(300, 700);
    await page.locator("#loginButton4").click({ timeout: 10_000 });

    const pass = page.locator('input[name="Password"]').first();
    await pass.waitFor({ state: "visible", timeout: 25_000 });
    await dismissCookieBanner(page);
    await pass.click();
    await pass.fill(password);
    await randomPause(300, 700);
    await tickRemember(page);
    const submit3 = page.locator("#loginButton3");
    const modalLogin = page.locator('[class*="Modal-module_modal"] button:has-text("Login")');
    if (await submit3.isVisible({ timeout: 4_000 }).catch(() => false)) await submit3.click();
    else if (await modalLogin.first().isVisible({ timeout: 2_000 }).catch(() => false)) await modalLogin.first().click();
    else await pass.press("Enter");

    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await randomPause(1_200, 2_200);
    const after = await hasCaptchaOrChallenge(page);
    if (after) return { ok: false, status: "login_required", note: `Openlane: pēc login ${after}; jāielogojas manuāli.` };
    const text = await pageText(page, 6_000);
    if (looksLikeTwoFactor(text)) return { ok: false, status: "login_required", note: "Openlane: prasa e-pasta / 2FA kodu; jāielogojas manuāli." };

    if (await isLoggedIn(page)) return { ok: true, status: "ok", note: "auto_login_ok" };
    return { ok: false, status: "login_required", note: "Openlane: pēc login sesija nav redzama (#loginButton2 vai CurrentUserDetails)." };
  } catch (e) {
    return { ok: false, status: "error", note: `Openlane: login kļūda ${e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma"}` };
  }
}

function withPage(bodyText, pageNumber) {
  const body = JSON.parse(bodyText);
  body.Paging = { ...(body.Paging ?? {}), PageNumber: pageNumber };
  return body;
}

async function collectAnchors(page) {
  try {
    return await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => a.href).filter((h) => /openlane\.eu\//i.test(h)));
  } catch {
    return [];
  }
}

/**
 * @returns {Promise<{status: "ok"|"login_required"|"blocked"|"error", note: string, items: object[], raw: object, pagesFetched: number, pageCount: number}>}
 */
async function fetchSource(page, sourceUrl, { maxPages, log }) {
  const captured = { request: null, response: null };
  const onResponse = async (res) => {
    if (captured.response) return;
    const req = res.request();
    if (req.method() !== "POST" || !SEARCH_API_RE.test(res.url())) return;
    try {
      const json = await res.json();
      captured.request = { url: res.url(), headers: req.headers(), postData: req.postData() ?? "" };
      captured.response = json;
    } catch {
      /* nav JSON */
    }
  };
  page.on("response", onResponse);
  try {
    await page.goto(openlaneEnglishUrl(sourceUrl), { waitUntil: "domcontentloaded", timeout: 45_000 });
    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge === "cloudflare_challenge") {
      await randomPause(6_000, 9_000);
      if ((await hasCaptchaOrChallenge(page)) === "cloudflare_challenge") return fail("blocked", "Cloudflare challenge nepāriet arī īstā pārlūkā.");
    }
    const deadline = Date.now() + 30_000;
    while (!captured.response && Date.now() < deadline) await randomPause(400, 700);
    if (!captured.response) {
      if (LOGGED_OUT_HOST_RE.test(page.url())) return fail("login_required", "Openlane pārvirzīja uz login.");
      return fail("error", `SPA neizsauca findcarv6/search 30 s laikā (${page.url().slice(0, 80)}).`);
    }

    const nowMs = Date.now();
    const anchors = await collectAnchors(page);
    const first = captured.response;
    const auctions = Array.isArray(first.Auctions) ? first.Auctions : [];
    const count = num(first.Count) ?? auctions.length;
    const perPage = Math.max(1, num(JSON.parse(captured.request.postData || "{}")?.Paging?.ItemsPerPage) ?? auctions.length ?? 20);
    const pageCount = Math.max(1, Math.ceil(count / perPage));
    const items = new Map();
    const rawPages = [first];
    for (const a of auctions) {
      const item = mapOpenlaneAuction(a, anchors, nowMs);
      if (item.externalId) items.set(item.externalId, item);
    }

    let pagesFetched = 1;
    const headers = Object.fromEntries(
      Object.entries(captured.request.headers).filter(([k]) => /^(content-type|accept|requestverificationtoken|__requestverificationtoken|x-requested-with|x-xsrf-token)$/i.test(k)),
    );
    for (let p = 2; p <= Math.min(pageCount, maxPages); p += 1) {
      await randomPause(1_200, 2_600);
      const body = withPage(captured.request.postData, p);
      const json = await page.evaluate(
        async ({ url, body, headers }) => {
          const r = await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
          if (!r.ok) return { __status: r.status };
          return r.json();
        },
        { url: captured.request.url, body, headers },
      );
      if (!json || json.__status) {
        log(`openlane ${p}. lapa HTTP ${json?.__status ?? "?"}`);
        break;
      }
      rawPages.push(json);
      pagesFetched += 1;
      const more = Array.isArray(json.Auctions) ? json.Auctions : [];
      for (const a of more) {
        const item = mapOpenlaneAuction(a, anchors, nowMs);
        if (item.externalId && !items.has(item.externalId)) items.set(item.externalId, item);
      }
      if (more.length === 0) break;
    }

    const loggedIn = await isLoggedIn(page);
    const notes = [];
    if (!loggedIn) notes.push("Lasīts bez login: daļa cenu (RequestedSalesPrice u.c.) var nebūt redzama.");
    if (pageCount > maxPages) notes.push(`Nolasītas ${pagesFetched}/${pageCount} lapas (limits ${maxPages}).`);
    if (items.size === 0) notes.push("Meklējums šobrīd nedod rezultātus (0 auto).");
    return {
      status: "ok",
      note: notes.join(" "),
      items: [...items.values()],
      raw: { kind: "openlane-findcarv6", request: { url: captured.request.url, postData: captured.request.postData }, pages: rawPages, loggedIn },
      pagesFetched,
      pageCount,
    };
  } catch (e) {
    return fail("error", e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda");
  } finally {
    page.off("response", onResponse);
  }
}

function fail(status, note) {
  return { status, note, items: [], raw: null, pagesFetched: 0, pageCount: 0 };
}
