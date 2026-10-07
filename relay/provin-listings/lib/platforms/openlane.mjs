/**
 * Openlane: Cloudflare laiž cauri tikai īstu pārlūku. Sarakstu neparsējam no HTML:
 * pārlūks atver pasūtījuma meklēšanas URL, SPA pats sūta POST /en/findcarv6/search, mēs to
 * pārtveram (body + atbilde), tad nākamās lapas pieprasām no lapas iekšpuses ar to pašu body
 * un mainītu Paging.PageNumber. Tā nav jāmin query / FacetRequest formāts.
 *
 * Sesija beidzas ik pēc pāris stundām. /en/login ir 404: login ir findcar popups
 * (#loginButton2 -> input[name=Email] ar OPENLANE_USER kā username -> #loginButton4 -> parole,
 * bieži id.openlane.eu). Captcha / 2FA -> login_required. Sekme: ChassisNumber nav null.
 */
import { hasCaptchaOrChallenge, looksLikeTwoFactor, pageText, randomPause } from "../browser.mjs";
import { isoDate, makeItem, num, price, str, yearOf } from "../items.mjs";
import { dismissCookieBanner, tickRemember } from "../login.mjs";
import { searchShowsOpenlaneLogin } from "../policy.mjs";

const PROBE_URL = process.env.OPENLANE_PROBE_URL || "https://www.openlane.eu/en/findcar";
const SEARCH_API_RE = /\/findcarv6\/search/i;
const LOGGED_IN_RE = new RegExp(process.env.OPENLANE_LOGGED_IN_TEXT || "(log ?out|sign out|my account|my openlane|mijn account|abmelden)", "i");
const LOGGED_OUT_HOST_RE = /id\.openlane\.eu|\/login\b|\/signin\b/i;
const DETAIL_TEMPLATE = process.env.OPENLANE_DETAIL_URL_TEMPLATE || "https://www.openlane.eu/en/car/{auctionId}";

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

async function probeOpenlaneSession(page) {
  let result = null;
  const onResponse = async (res) => {
    if (result !== null) return;
    if (!SEARCH_API_RE.test(res.url()) || res.request().method() !== "POST") return;
    try {
      const shown = searchShowsOpenlaneLogin(await res.json());
      if (shown !== null) result = shown;
    } catch {
      /* atbilde nav JSON */
    }
  };
  page.on("response", onResponse);
  try {
    await page.goto(PROBE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const deadline = Date.now() + 15_000;
    while (result === null && Date.now() < deadline) await randomPause(250, 450);
    return result;
  } finally {
    page.off("response", onResponse);
  }
}

async function isLoggedIn(page) {
  if (LOGGED_OUT_HOST_RE.test(page.url())) return false;
  const chassis = await probeOpenlaneSession(page);
  if (chassis === true) return true;
  if (chassis === false) return false;
  const text = await pageText(page, 8_000);
  return LOGGED_IN_RE.test(text);
}

async function login(page) {
  const username = process.env.OPENLANE_USER || "";
  const password = process.env.OPENLANE_PASS || "";
  if (!username || !password) return { ok: false, status: "login_required", note: "Openlane: nav lietotāja / paroles env." };
  try {
    await page.goto(PROBE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
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

    const pass = page.locator('input[type="password"]').first();
    await pass.waitFor({ state: "visible", timeout: 25_000 });
    await dismissCookieBanner(page);
    await pass.click();
    await pass.fill(password);
    await randomPause(300, 700);
    await tickRemember(page);
    const submit = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Next")').first();
    if (await submit.isVisible({ timeout: 4_000 }).catch(() => false)) await submit.click();
    else await pass.press("Enter");

    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await randomPause(1_200, 2_200);
    const after = await hasCaptchaOrChallenge(page);
    if (after) return { ok: false, status: "login_required", note: `Openlane: pēc login ${after}; jāielogojas manuāli.` };
    const text = await pageText(page, 6_000);
    if (looksLikeTwoFactor(text)) return { ok: false, status: "login_required", note: "Openlane: prasa e-pasta / 2FA kodu; jāielogojas manuāli." };

    const chassis = await probeOpenlaneSession(page);
    if (chassis === true) return { ok: true, status: "ok", note: "auto_login_ok" };
    return { ok: false, status: "login_required", note: "Openlane: pēc login ChassisNumber ir null." };
  } catch (e) {
    return { ok: false, status: "error", note: `Openlane: login kļūda ${e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma"}` };
  }
}

function detailUrlFor(auction, anchors) {
  const auctionId = str(auction.AuctionId);
  const carId = str(auction.CarId);
  const hit = anchors.find((h) => (auctionId && new RegExp(`[/=-]${auctionId}(?:[/?#]|$)`).test(h)) || (carId && new RegExp(`[/=-]${carId}(?:[/?#]|$)`).test(h)));
  if (hit) return hit;
  return DETAIL_TEMPLATE.replace("{auctionId}", encodeURIComponent(auctionId)).replace("{carId}", encodeURIComponent(carId));
}

function stageFor(auction, nowMs) {
  const start = Date.parse(isoDate(auction.BatchStartDate));
  const end = Date.parse(isoDate(auction.BatchEndDate));
  if (Number.isFinite(start) && nowMs < start) return "BEFORE_AUCTION";
  if (Number.isFinite(end) && nowMs > end) return "AFTER_AUCTION";
  if (Number.isFinite(start) || Number.isFinite(end)) return "IN_AUCTION";
  return str(auction.AuctionType || auction.SaleType);
}

export function mapOpenlaneAuction(auction, anchors = [], nowMs = Date.now()) {
  const requested = auction.RequestedSalesPrice;
  const requestedShown = auction.RequestedSalesPriceCanBeShown ?? auction.CanBeShown ?? true;
  const title = str(auction.CarNameEn || auction.CarName || auction.Title);
  return makeItem("openlane", {
    externalId: str(auction.AuctionId) || str(auction.CarId),
    auctionId: str(auction.AuctionId),
    detailUrl: detailUrlFor(auction, anchors),
    title,
    manufacturer: str(auction.Make || auction.MakeName) || title.split(" ")[0],
    year: yearOf(auction.FirstRegistrationDate || auction.RegistrationDate || auction.Year || auction.BuildYear),
    firstRegistration: isoDate(auction.FirstRegistrationDate || auction.RegistrationDate).slice(0, 10),
    mileageKm: num(auction.Mileage),
    fuel: str(auction.FuelType || auction.Fuel),
    transmission: str(auction.Transmission || auction.TransmissionType || auction.Gearbox),
    powerKw: str(auction.PowerKw || auction.KW || auction.Power),
    location: str(auction.LocationName || auction.City || auction.Location),
    countryCode: str(auction.CountryCode || auction.OriginCountry || auction.Country),
    imageUrl: str(auction.ThumbnailUrl || auction.ImageUrl),
    currency: str(auction.Currency) || "EUR",
    priceStart: price(auction.StartPrice),
    priceCurrent: price(auction.CurrentPrice ?? auction.MaximumBid),
    priceMinimal: requestedShown ? price(requested) : null,
    priceBuyNow: price(auction.BuyNowPrice),
    vatNote: str(auction.VatType || auction.VatRegime || (auction.VatDeductible === true ? "VAT deductible" : "")),
    auctionStartAt: isoDate(auction.BatchStartDate),
    auctionEndAt: isoDate(auction.BatchEndDate),
    auctionStage: stageFor(auction, nowMs),
  });
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
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
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
