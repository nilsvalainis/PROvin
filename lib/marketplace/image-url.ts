/**
 * Nils 31.10: mobile.de bildes Apify dod caur `m.mobile.de/yams-proxy/img.classistatic.de/...`.
 * Pārlūks tās prasa no mobile.de lietotnes servera (Akamai), kas bloķē IP un nerāda bildes.
 * Rādām tieši no CDN `img.classistatic.de` ar izmēra noteikumu (`rule=mo-640.jpg`). Tikai saite, ne kopija.
 */

export type MobileDeImageSize = 360 | 640 | 1024 | 1600;

const PROXY = /^https?:\/\/m\.mobile\.de\/yams-proxy\/(img\.classistatic\.de\/.+)$/i;
const CDN = /^https?:\/\/img\.classistatic\.de\/api\/v1\/mo-prod\/images\//i;

export function mobileDeImageDisplayUrl(raw: string, size: MobileDeImageSize = 1024): string {
  const url = (raw ?? "").trim();
  if (!url) return "";
  const proxied = url.match(PROXY);
  const direct = proxied ? `https://${proxied[1]}` : CDN.test(url) ? url : "";
  if (!direct) return url;
  try {
    const u = new URL(direct);
    u.searchParams.set("rule", `mo-${size}.jpg`);
    return u.toString();
  } catch {
    return url;
  }
}
