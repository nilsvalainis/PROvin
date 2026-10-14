/**
 * VIN SCAN izsoļu lapas caur īstu Chrome (stat.vin WAF, bid.cars, BidFax, u.c.).
 * Nav IRISS platforma: atsevišķs profils `vinscan`, bez Openlane/Auto1 sīkdatnēm.
 */

export const VINSCAN_PAGE_HOSTS = [
  "stat.vin",
  "bid.cars",
  "checkcar.vin",
  "bidfax.info",
  "poctra.com",
  "plc.auction",
];

const HTML_LIMIT = 400_000;
const CHALLENGE_WAIT_MS = 18_000;
const POLL_MS = 1_500;

export function validVinScanPageUrl(raw) {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    const ok = VINSCAN_PAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return ok ? u.toString() : "";
  } catch {
    return "";
  }
}

function looksBlocked(html, title) {
  const blob = `${title}\n${html}`.slice(0, 80_000);
  return /just a moment|cf-chl|challenge-platform|attention required|access blocked|enable javascript and cookies to continue/i.test(
    blob,
  );
}

export async function fetchVinScanPageHtml(page, url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const deadline = Date.now() + Math.min(CHALLENGE_WAIT_MS, timeoutMs);
  while (Date.now() < deadline) {
    const html = await page.content();
    const title = await page.title().catch(() => "");
    if (!looksBlocked(html, title)) break;
    await sleep(POLL_MS);
  }
  const html = await page.content();
  return {
    status: typeof resp?.status === "function" ? resp.status() : 0,
    finalUrl: page.url(),
    html: String(html ?? "").slice(0, HTML_LIMIT),
  };
}
