/**
 * Autobid publiski jau strādā no Vercel (lib/iriss-listings-autobid.ts). Relejs lasa to pašu
 * `__NUXT_DATA__` ar ielogotu profilu, lai redz vairāk (pašreizējais solījums, rezerves cena).
 * Parsēšana notiek Vercel pusē ar esošo parsētāju, tāpēc šeit atdodam tikai raw NUXT JSON pa lapām.
 * Sesija beidzas ik pēc pāris stundām: auto-login ar AUTOBID_USER / AUTOBID_PASS.
 */
import { hasCaptchaOrChallenge, pageText, randomPause } from "../browser.mjs";
import { autoLogin } from "../login.mjs";

const LOGIN_URL = process.env.AUTOBID_LOGIN_URL || "https://autobid.de/en/login";
const PROBE_URL = process.env.AUTOBID_PROBE_URL || "https://autobid.de/en/search-results";
const LOGGED_IN_RE = new RegExp(process.env.AUTOBID_LOGGED_IN_TEXT || "(log ?out|abmelden|my ?autobid|mein ?autobid|iziet|mans ?autobid)", "i");

export const autobid = {
  id: "autobid",
  label: "Autobid",
  hasCredentials: () => Boolean(process.env.AUTOBID_USER && process.env.AUTOBID_PASS),
  loginUrl: LOGIN_URL,
  probeUrl: PROBE_URL,
  isLoggedIn,
  login,
  fetchSource,
};

async function isLoggedIn(page) {
  const text = await pageText(page, 15_000);
  return LOGGED_IN_RE.test(text);
}

async function login(page) {
  return autoLogin(page, {
    loginUrl: LOGIN_URL,
    username: process.env.AUTOBID_USER,
    password: process.env.AUTOBID_PASS,
    isLoggedIn,
    platformLabel: "Autobid",
    userSelector: process.env.AUTOBID_USER_SELECTOR || 'input[name="login"]',
    passSelector: process.env.AUTOBID_PASS_SELECTOR || 'input[name="password"]',
    submitSelector: process.env.AUTOBID_SUBMIT_SELECTOR || 'button:has-text("Login"), input[type="submit"]',
  });
}

function pageUrl(sourceUrl, p) {
  const u = new URL(sourceUrl);
  if (p <= 1) u.searchParams.delete("currentPage");
  else u.searchParams.set("currentPage", String(p));
  return u.toString();
}

async function readNuxtData(page) {
  return page.evaluate(() => {
    const el = document.getElementById("__NUXT_DATA__");
    return el ? el.textContent || "" : "";
  });
}

function pageCountFromNuxt(json) {
  try {
    const arr = JSON.parse(json);
    const d = arr.find((x) => x && typeof x === "object" && !Array.isArray(x) && "itemPageCount" in x && "items" in x);
    const pc = d ? arr[d.itemPageCount] : 0;
    return typeof pc === "number" ? pc : 0;
  } catch {
    return 0;
  }
}

async function fetchSource(page, sourceUrl, { maxPages, log }) {
  try {
    const rawPages = [];
    let pageCount = 0;
    for (let p = 1; p <= maxPages; p += 1) {
      if (p > 1) {
        if (p > pageCount) break;
        await randomPause(1_200, 2_600);
      }
      const resp = await page.goto(pageUrl(sourceUrl, p), { waitUntil: "domcontentloaded", timeout: 45_000 });
      const status = resp?.status() ?? 0;
      if (status === 403 || status === 429) return fail("blocked", `Autobid HTTP ${status}.`);
      if (status === 401) return fail("login_required", "Autobid HTTP 401.");
      const challenge = await hasCaptchaOrChallenge(page);
      if (challenge) return fail("blocked", `Autobid rāda ${challenge}.`);
      const nuxt = await readNuxtData(page);
      if (!nuxt) {
        if (p === 1) return fail("error", "Lapā nav __NUXT_DATA__.");
        break;
      }
      rawPages.push(nuxt.slice(0, 1_500_000));
      pageCount = Math.max(pageCount, pageCountFromNuxt(nuxt));
    }
    const loggedIn = await isLoggedIn(page);
    log(`autobid ${rawPages.length}/${pageCount} lapas, loggedIn=${loggedIn}`);
    return {
      status: "ok",
      note: loggedIn ? "" : "Lasīts bez login (publiskie dati).",
      items: [],
      raw: { kind: "autobid-nuxt", nuxtPages: rawPages, loggedIn },
      pagesFetched: rawPages.length,
      pageCount,
    };
  } catch (e) {
    return fail("error", e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda");
  }
}

function fail(status, note) {
  return { status, note, items: [], raw: null, pagesFetched: 0, pageCount: 0 };
}
