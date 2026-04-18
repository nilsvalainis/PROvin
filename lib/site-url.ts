/**
 * Derīgs `origin` no `NEXT_PUBLIC_SITE_URL` — `metadataBase`, sitemap, robots.
 * Vērtība bez shēmas (piem. `provin.lv`) citādi lauž `new URL(...)`; kļūdainu URL — drošs noklusējums.
 */
export function getPublicSiteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (!raw) return "http://localhost:3000";
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(normalized).origin;
  } catch {
    return "http://localhost:3000";
  }
}
