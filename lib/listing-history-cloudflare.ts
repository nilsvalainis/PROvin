/**
 * Cloudflare challenge lapas (Adify, Tirgus Dati u.c. vēstures avoti).
 * Tīra funkcija - bez tīkla, lai testi un serveris rīkotos vienādi.
 *
 * Cloudflare Bot Management katrā PARASTĀ lapā ievieto JSD skriptu
 * `/cdn-cgi/challenge-platform/scripts/jsd/main.js`. Tas nav izaicinājums:
 * Adify lapa ar `__NEXT_DATA__` un vēstures ierakstiem to satur vienmēr.
 * Ja to skaita kā izaicinājumu, katra veiksmīga ielase (arī Tampermonkey)
 * tiek atmesta kā "Cloudflare bloķēja".
 */
const CF_JSD_SCRIPT_RE = /\/cdn-cgi\/challenge-platform\/scripts\/jsd\/[^"'\s<>)]*/gi;

const CF_CHALLENGE_RE =
  /just a moment|cf-browser-verification|challenge-platform|performing security verification|enable javascript and cookies to continue|attention required|checking your browser/i;

export function looksLikeListingHistoryCloudflareChallenge(html: string): boolean {
  return CF_CHALLENGE_RE.test(String(html ?? "").replace(CF_JSD_SCRIPT_RE, ""));
}
