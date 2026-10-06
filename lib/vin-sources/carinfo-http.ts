import "server-only";

/**
 * car.info HTTP: super-search JSON pa Nordics lokalēm, tad ident lapa.
 * Vercel IP bieži dabū Cloudflare IUAM. CapSolver AntiCloudflareTask dod cf_clearance
 * (vajag sticky proxy: CAPSOLVER_PROXY vai FIXIE_URL).
 */
import {
  getCaptchaSolverProxy,
  hasCaptchaSolverKey,
  httpProxyUrlFromCapsolver,
  solveCaptcha,
} from "@/lib/captcha-solver";
import { parseCarinfoExtract } from "@/lib/vin-sources/carinfo-parse";
import {
  CARINFO_SEARCH_LOCALES,
  carinfoSuperSearchUrl,
  parseCarinfoSearchBody,
  type CarinfoSearchHit,
} from "@/lib/vin-sources/carinfo-search";
import {
  cookiesRecordToHeader,
  extractPageFromHtml,
  isCloudflareChallengeHtml,
  mergeCookieHeader,
} from "@/lib/vin-sources/html-extract";
import { VIN_HTTP_UA, vinHttpFetch, type VinHttpResult } from "@/lib/vin-sources/http";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const ORIGIN = "https://www.car.info";

type Session = {
  cookie: string;
  ua: string;
  proxyUrl?: string;
};

function searchHeaders(locale: string, ua: string): Record<string, string> {
  return {
    accept: "application/json, text/javascript, */*; q=0.01",
    "accept-language": "sv-SE,sv;q=0.9,en;q=0.8,da;q=0.7",
    "user-agent": ua,
    "x-requested-with": "XMLHttpRequest",
    referer: `${ORIGIN}/${locale}/`,
  };
}

function pageHeaders(ua: string): Record<string, string> {
  return {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "sv-SE,sv;q=0.9,en;q=0.8,da;q=0.7",
    "user-agent": ua,
    referer: `${ORIGIN}/en-se/`,
  };
}

async function get(url: string, session: Session, headers: Record<string, string>): Promise<VinHttpResult> {
  return vinHttpFetch(url, {
    cookie: session.cookie,
    proxyUrl: session.proxyUrl,
    headers,
    timeoutMs: 20_000,
  });
}

async function bypassCloudflare(
  websiteURL: string,
  challenged: VinHttpResult,
  session: Session,
): Promise<Session | { reason: string }> {
  if (!hasCaptchaSolverKey()) {
    return { reason: "car.info Cloudflare: nav CAPSOLVER_API_KEY" };
  }
  const proxy = getCaptchaSolverProxy();
  if (!proxy) {
    return { reason: "car.info Cloudflare Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL" };
  }
  const solved = await solveCaptcha(
    {
      kind: "cloudflare_challenge",
      websiteURL,
      proxy,
      html: challenged.text.slice(0, 80_000),
      userAgent: session.ua,
    },
    { timeoutMs: 90_000 },
  );
  if (!solved.ok) return { reason: solved.reason };
  const fromCookies = cookiesRecordToHeader(solved.cookies);
  const clearance = fromCookies || (solved.token ? `cf_clearance=${solved.token}` : "");
  if (!clearance) return { reason: "CapSolver: cf_clearance tukšs" };
  return {
    cookie: mergeCookieHeader(session.cookie, clearance),
    ua: solved.userAgent || session.ua,
    proxyUrl: httpProxyUrlFromCapsolver(proxy) ?? session.proxyUrl,
  };
}

async function throughChallenge(
  url: string,
  session: Session,
  headers: Record<string, string>,
  solveUrl: string,
): Promise<{ res: VinHttpResult; session: Session } | { reason: string }> {
  let res = await get(url, session, headers);
  if (!isCloudflareChallengeHtml(res.text, res.status)) return { res, session };
  const next = await bypassCloudflare(solveUrl, res, session);
  if ("reason" in next) return next;
  res = await get(url, next, { ...headers, "user-agent": next.ua });
  if (isCloudflareChallengeHtml(res.text, res.status)) {
    return { reason: "car.info Cloudflare netika apietas" };
  }
  return { res, session: next };
}

export async function fetchCarinfoHttp(vin: string): Promise<VinSourceFetchResult> {
  let session: Session = { cookie: "", ua: VIN_HTTP_UA };
  const timeMs = Date.now();
  let hit: CarinfoSearchHit | null = null;

  for (const locale of CARINFO_SEARCH_LOCALES) {
    const url = carinfoSuperSearchUrl(locale, vin, timeMs);
    const passed = await throughChallenge(url, session, searchHeaders(locale, session.ua), `${ORIGIN}/${locale}/`);
    if ("reason" in passed) return emptyVinSourceResult("carinfo", vin, passed.reason);
    session = passed.session;
    if (passed.res.status >= 400) continue;
    const parsed = parseCarinfoSearchBody(passed.res.text, vin);
    if (parsed) {
      hit = parsed;
      break;
    }
  }

  if (!hit) {
    return emptyVinSourceResult(
      "carinfo",
      vin,
      "car.info meklēšanā šo VIN neatradīja (Zviedrija un citi Nordics)",
    );
  }

  const pagePass = await throughChallenge(hit.href, session, pageHeaders(session.ua), hit.href);
  if ("reason" in pagePass) return emptyVinSourceResult("carinfo", vin, pagePass.reason);
  const page = pagePass.res;
  if (page.status >= 400 || /vin.{0,20}(not found|no result)|page not found/i.test(page.text)) {
    return emptyVinSourceResult(
      "carinfo",
      vin,
      `car.info ident atrasts (${hit.country || "?"}), bet lapa nav pieejama`,
    );
  }

  const extracted = extractPageFromHtml(page.text);
  const parsed = parseCarinfoExtract(extracted);
  return {
    source: "carinfo",
    vin,
    found: parsed.found,
    message: parsed.found
      ? `Nolasīts no ${hit.href} (${parsed.mileage.length} nobraukuma ieraksti)`
      : "car.info lapa atvērta, bet publiski strukturēti dati netika atrasti",
    mileage: parsed.mileage,
    incidents: parsed.incidents,
    timeline: [],
    ownersSummary: parsed.ownersSummary,
    statusRecords: parsed.statusRecords,
    notes: parsed.notes,
    raw: extracted.text.slice(0, 20_000),
    fetchedAt: new Date().toISOString(),
  };
}
