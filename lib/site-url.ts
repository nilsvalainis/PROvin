/**
 * Derīgs `origin` no `NEXT_PUBLIC_SITE_URL`: `metadataBase`, sitemap, robots.
 * Vērtība bez shēmas (piem. `provin.lv`) citādi lauž `new URL(...)`; kļūdainu URL: drošs noklusējums.
 * Produkcijas hosts vienmēr `www.provin.lv`, arī ja env ir apex (`https://provin.lv`).
 */
export function getPublicSiteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (!raw) return "http://localhost:3000";
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(normalized);
    if (url.hostname === "provin.lv" || url.hostname === "www.provin.lv") {
      url.protocol = "https:";
      url.hostname = "www.provin.lv";
      url.port = "";
    }
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
