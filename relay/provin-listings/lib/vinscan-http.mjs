/**
 * car.info super-search JSON caur parasto HTTP, nevis Chrome page.goto.
 * Pārlūka navigācija uz šo XHR adresi saņem HTTP 403 un classify to tur kā
 * nepabeigtu izaicinājumu līdz visam ~52 s limitam. curl ar XHR galvenēm
 * no tā paša servera atdod 200 JSON ātrāk par 1 s.
 */

const HTTP_TIMEOUT_MS = 8_000;
const BODY_LIMIT = 500_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function validCarinfoSuperSearchUrl(raw) {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    if (host !== "www.car.info" && host !== "car.info") return "";
    if (!/^\/[a-z]{2}-[a-z]{2}\/search\/super\/[A-Z0-9]{11,17}$/i.test(u.pathname)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

function refererFor(url) {
  try {
    const locale = new URL(url).pathname.split("/").filter(Boolean)[0] || "sv-se";
    return `https://www.car.info/${locale}/`;
  } catch {
    return "https://www.car.info/sv-se/";
  }
}

function carInfoHost(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "www.car.info" || host === "car.info";
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ok: boolean, status?: number, html?: string, finalUrl?: string, elapsedMs?: number, error?: string}>}
 */
export async function fetchCarinfoSuperSearchHttp(url, opts = {}) {
  const started = Date.now();
  const target = validCarinfoSuperSearchUrl(url);
  if (!target) return { ok: false, error: "url nav car.info super-search", elapsedMs: 0 };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? HTTP_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(target, {
      method: "GET",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
        referer: refererFor(target),
        "accept-language": "sv-SE,sv;q=0.9,en;q=0.8",
        "user-agent": UA,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = typeof res.url === "string" && res.url ? res.url : target;
    if (!carInfoHost(finalUrl)) {
      return { ok: false, error: "car.info super-search novirzīja prom no car.info", elapsedMs: Date.now() - started };
    }
    const raw = typeof res.text === "function" ? await res.text() : "";
    const status = typeof res.status === "number" ? res.status : 0;
    return {
      ok: true,
      status,
      html: String(raw ?? "").slice(0, BODY_LIMIT),
      finalUrl,
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    const aborted = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return {
      ok: false,
      error: aborted
        ? `car.info super-search neatbildēja ${Math.round(timeoutMs / 1000)} s laikā`
        : "car.info super-search savienojums neizdevās",
      elapsedMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
