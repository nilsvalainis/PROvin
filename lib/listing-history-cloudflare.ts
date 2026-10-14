/**
 * Cloudflare challenge lapas (Adify, Tirgus Dati u.c. vēstures avoti).
 * Tīra funkcija — bez tīkla, lai testi un serveris rīkotos vienādi.
 */
export function looksLikeListingHistoryCloudflareChallenge(html: string): boolean {
  return /just a moment|cf-browser-verification|challenge-platform|performing security verification|enable javascript and cookies to continue|attention required|checking your browser/i.test(
    html,
  );
}
