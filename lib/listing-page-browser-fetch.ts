/**
 * Sludinājuma lapas rezerves ielase caur PROVIN Tampermonkey skriptu (operatora pārlūks), ja servera
 * IP portāls bloķē. Tikai šie portāli; mobile.de NEKAD (Akamai bloķē - arī Nila pārlūku).
 * Tas pats saraksts ir skriptā (`LISTING_PAGE_HOSTS` + `@connect`) - sinhronitāti pārbauda tests.
 */

export const LISTING_PAGE_BROWSER_HOSTS = [
  "ss.lv",
  "ss.com",
  "auto24.lv",
  "auto24.ee",
  "autoplius.lt",
  "reklama.lv",
  "andele.lv",
  "andelemandele.lv",
] as const;

/** Skripta versija, kurā ir `provin-listing-page-request` tilts. */
export const LISTING_PAGE_BROWSER_MIN_USERSCRIPT = "1.26.3";

function hostAllowed(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (h === "mobile.de" || h.endsWith(".mobile.de")) return false;
  return LISTING_PAGE_BROWSER_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Vai šo saiti drīkst ielasīt operatora pārlūkā (https, atļauts portāls, ne mobile.de). */
export function listingPageBrowserFetchAllowed(raw: string | null | undefined): boolean {
  try {
    const u = new URL(String(raw ?? "").trim());
    return u.protocol === "https:" && hostAllowed(u.hostname);
  } catch {
    return false;
  }
}

export function userscriptVersionAllowsListingPageFetch(raw: string): boolean {
  const want = LISTING_PAGE_BROWSER_MIN_USERSCRIPT.split(".").map(Number);
  const have = raw.split(".").map((n) => Number(n));
  if (!have.every((n) => Number.isFinite(n)) || have.length === 0) return false;
  for (let i = 0; i < want.length; i++) {
    const a = have[i] ?? 0;
    if (a !== want[i]) return a > want[i]!;
  }
  return true;
}
