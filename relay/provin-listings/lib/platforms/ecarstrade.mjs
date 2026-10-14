/**
 * eCarsTrade cenas (logged-in /search + /cars/{id}) īstā Chrome.
 * Inventāru Vercel joprojām lasa no future_api.php; relejs atdod HTML, ko Vercel
 * saplūdina ar mergeEcarstradeHtmlPrices / parseEcarstradeSearchHtml.
 * Paroles: ECARSTRADE_USER / ECARSTRADE_PASS (tikai /etc/provin-listings.env).
 */
import { hasCaptchaOrChallenge, pageText, randomPause } from "../browser.mjs";

const ORIGIN = "https://ecarstrade.com";
const LOGIN_URL = process.env.ECARSTRADE_LOGIN_URL || `${ORIGIN}/search`;
const PROBE_URL = process.env.ECARSTRADE_PROBE_URL || `${ORIGIN}/search`;
const AUTH_PATH = "/api/v1/auth/login";
const LOGGED_IN_RE = new RegExp(
  process.env.ECARSTRADE_LOGGED_IN_TEXT || "(log ?out|iziet|sign out|my account|mans konts|pirkt uzreiz|\\bpirkt\\b)",
  "i",
);

export const ecarstrade = {
  id: "ecarstrade",
  label: "eCarsTrade",
  hasCredentials: () => Boolean(process.env.ECARSTRADE_USER && process.env.ECARSTRADE_PASS),
  loginUrl: LOGIN_URL,
  probeUrl: PROBE_URL,
  isLoggedIn,
  login,
  fetchSource,
};

export function ecarstradeRelaySearchPageUrl(sourceUrl, page, perPage = 20) {
  const u = new URL(sourceUrl);
  const start = page <= 1 ? 0 : (page - 1) * perPage;
  if (start > 0) u.searchParams.set("start", String(start));
  else u.searchParams.delete("start");
  return u.toString();
}

export function ecarstradeRelayDetailUrl(id) {
  const clean = String(id ?? "").replace(/\D/g, "");
  return clean ? `${ORIGIN}/cars/${clean}` : "";
}

export function collectEcarstradeCardIds(html) {
  const ids = [];
  const re = /data-itemId=["'](\d+)["']/gi;
  let m;
  while ((m = re.exec(String(html ?? "")))) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/** Kartīte bez PIRKT / cenas (publiskais „Sign in to buy”). */
export function ecarstradeCardNeedsPrice(htmlSlice) {
  const s = String(htmlSlice ?? "");
  if (/sign in to buy/i.test(s)) return true;
  if (/\b(?:pirkt uzreiz|buy now|pirkt)\b/i.test(s) && /€|eur/i.test(s)) return false;
  return !/€\s*\d|\d[\d.\s]*\s*€/i.test(s);
}

export function idsNeedingDetailPrice(html) {
  const text = String(html ?? "");
  const missing = [];
  const re = /data-itemId=["'](\d+)["']/gi;
  let m;
  while ((m = re.exec(text))) {
    const id = m[1];
    if (!id || missing.includes(id)) continue;
    const start = text.lastIndexOf("<div", m.index);
    const slice = text.slice(Math.max(0, start), m.index + 8_000);
    if (ecarstradeCardNeedsPrice(slice)) missing.push(id);
  }
  return missing;
}

async function isLoggedIn(page) {
  const cookieHit = await page
    .evaluate(() => typeof document !== "undefined" && /eCT\/user=/.test(document.cookie))
    .catch(() => false);
  if (cookieHit) return true;
  const text = await pageText(page, 12_000);
  return LOGGED_IN_RE.test(text) && !/sign in to buy/i.test(text);
}

async function login(page) {
  const username = process.env.ECARSTRADE_USER;
  const password = process.env.ECARSTRADE_PASS;
  if (!username || !password) {
    return { ok: false, status: "login_required", note: "eCarsTrade: nav lietotāja / paroles env." };
  }
  try {
    await page.goto(`${ORIGIN}/setsession.php`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(400, 900);
    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge) {
      return { ok: false, status: "login_required", note: `eCarsTrade: login lapā ${challenge}; jāielogojas manuāli.` };
    }
    const result = await page.evaluate(
      async ({ authPath, username: user, password: pass }) => {
        const res = await fetch(authPath, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ username: user, password: pass }),
          credentials: "include",
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          return { ok: false, status: res.status, note: "not_json" };
        }
        const data = json && typeof json === "object" && json.data && typeof json.data === "object" ? json.data : json;
        const access = data && (data.accessToken || data.access_token);
        if (!access) return { ok: false, status: res.status, note: "no_token" };
        const refresh = data.refreshToken || data.refresh_token || "";
        document.cookie = `eCT/user=${encodeURIComponent(access)}; path=/`;
        if (refresh) document.cookie = `eCT/refresh-token=${encodeURIComponent(refresh)}; path=/`;
        return { ok: true, status: res.status };
      },
      { authPath: AUTH_PATH, username, password },
    );
    if (!result?.ok) {
      return {
        ok: false,
        status: result?.status === 401 || result?.status === 403 ? "login_required" : "error",
        note: `eCarsTrade: login ${result?.note || "neizdevās"} (HTTP ${result?.status ?? "?"}).`,
      };
    }
    await page.goto(PROBE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(800, 1_600);
    if (await isLoggedIn(page)) return { ok: true, status: "ok", note: "auto_login_ok" };
    return { ok: false, status: "login_required", note: "eCarsTrade: pēc login sesija joprojām nav aktīva." };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      note: `eCarsTrade: login kļūda ${e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma"}`,
    };
  }
}

async function fetchSource(page, sourceUrl, { maxPages, log }) {
  try {
    const searchPages = [];
    const detailPages = [];
    let pageCount = 1;
    const missingIds = new Set();
    for (let p = 1; p <= maxPages; p += 1) {
      if (p > 1) {
        if (p > pageCount) break;
        await randomPause(1_200, 2_600);
      }
      const resp = await page.goto(ecarstradeRelaySearchPageUrl(sourceUrl, p), {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const status = resp?.status() ?? 0;
      if (status === 403 || status === 429) return fail("blocked", `eCarsTrade HTTP ${status}.`);
      if (status === 401) return fail("login_required", "eCarsTrade HTTP 401.");
      const challenge = await hasCaptchaOrChallenge(page);
      if (challenge) return fail("blocked", `eCarsTrade rāda ${challenge}.`);
      const html = await page.content();
      searchPages.push(html.slice(0, 1_500_000));
      const ids = collectEcarstradeCardIds(html);
      for (const id of idsNeedingDetailPrice(html)) missingIds.add(id);
      if (ids.length === 0) {
        pageCount = p;
        break;
      }
      if (ids.length >= 20) pageCount = Math.max(pageCount, p + 1);
      else pageCount = p;
    }
    const detailLimit = Math.min(20, missingIds.size);
    let i = 0;
    for (const id of missingIds) {
      if (i >= detailLimit) break;
      i += 1;
      await randomPause(1_000, 2_200);
      const url = ecarstradeRelayDetailUrl(id);
      if (!url) continue;
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const status = resp?.status() ?? 0;
      if (status === 403 || status === 429) break;
      const challenge = await hasCaptchaOrChallenge(page);
      if (challenge) break;
      detailPages.push({ id, html: (await page.content()).slice(0, 800_000) });
    }
    const loggedIn = await isLoggedIn(page);
    log(`ecarstrade ${searchPages.length} meklēšanas, ${detailPages.length} detaļas, loggedIn=${loggedIn}`);
    return {
      status: "ok",
      note: loggedIn ? "eCarsTrade cenas no releja Chrome (/search)." : "eCarsTrade lasīts bez login (publiskās kartītes).",
      items: [],
      raw: { kind: "ecarstrade-html", searchPages, detailPages, loggedIn },
      pagesFetched: searchPages.length,
      pageCount,
    };
  } catch (e) {
    return fail("error", e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda");
  }
}

function fail(status, note) {
  return { status, note, items: [], raw: null, pagesFetched: 0, pageCount: 0 };
}
