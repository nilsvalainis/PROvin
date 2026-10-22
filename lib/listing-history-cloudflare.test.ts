import { describe, expect, it } from "vitest";
import { looksLikeListingHistoryCloudflareChallenge } from "@/lib/listing-history-cloudflare";

/** Saīsināta reāla adify.lv/history atbilde no LV IP (22.10.2026): dati + Cloudflare JSD skripts. */
const ADIFY_OK_WITH_JSD = `<!DOCTYPE html><html lang="lv"><head><title>Sludinājuma vēsture | Adify</title></head><body>
<div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"items":[{"price":4500,"created":"2026-10-01T10:00:00Z"}]}}}</script>
<script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a4ea1ec56ee236fc',t:'MTc5MjY4OTA3NQ=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}})();</script>
</body></html>`;

const CF_MANAGED_CHALLENGE = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body>
<div id="challenge-error-text">Enable JavaScript and cookies to continue</div>
<script>window._cf_chl_opt={cType:'managed'};</script>
<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1?ray=abc"></script>
</body></html>`;

describe("looksLikeListingHistoryCloudflareChallenge", () => {
  it("detects Just a moment and challenge-platform markers", () => {
    expect(looksLikeListingHistoryCloudflareChallenge("<title>Just a moment...</title>")).toBe(true);
    expect(looksLikeListingHistoryCloudflareChallenge('<div id="challenge-platform"></div>')).toBe(true);
    expect(looksLikeListingHistoryCloudflareChallenge("<html><body>OK history</body></html>")).toBe(false);
  });

  it("treats a real Adify page with the Cloudflare JSD script as data, not a challenge", () => {
    expect(looksLikeListingHistoryCloudflareChallenge(ADIFY_OK_WITH_JSD)).toBe(false);
  });

  it("still detects a managed challenge that also loads challenge-platform scripts", () => {
    expect(looksLikeListingHistoryCloudflareChallenge(CF_MANAGED_CHALLENGE)).toBe(true);
    expect(
      looksLikeListingHistoryCloudflareChallenge(
        `${CF_MANAGED_CHALLENGE}<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>`,
      ),
    ).toBe(true);
  });

  it("detects a challenge-platform orchestrate script even without a title", () => {
    expect(
      looksLikeListingHistoryCloudflareChallenge(
        '<html><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/managed/v1"></script></html>',
      ),
    ).toBe(true);
  });
});
