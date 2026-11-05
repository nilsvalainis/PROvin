/**
 * Nils 31.10: mobile.de bildes Apify dod caur `m.mobile.de/yams-proxy/img.classistatic.de/...`.
 * Pārlūks tās prasa no mobile.de lietotnes servera (Akamai), kas bloķē IP un nerāda bildes.
 * Rādām tieši no CDN `img.classistatic.de` ar izmēra noteikumu (`rule=mo-640.jpg`). Tikai saite, ne kopija.
 * Jebkura cita `*.mobile.de` saite atpakaļ netiek dota: tukša virkne, ne yams.
 */

import { isMobileDeAkamaiHost } from "@/lib/marketplace/mobile-de-guard";

export type MobileDeImageSize = 360 | 640 | 1024 | 1600;

const PROXY = /^https?:\/\/m\.mobile\.de\/yams-proxy\/(img\.classistatic\.de\/.+)$/i;
const CDN = /^https?:\/\/img\.classistatic\.de\/api\/v1\/mo-prod\/images\//i;

function pointsAtMobileDeAkamai(raw: string): boolean {
  try {
    return isMobileDeAkamaiHost(new URL(raw).hostname);
  } catch {
    return /mobile\.de/i.test(raw);
  }
}

export function mobileDeImageDisplayUrl(raw: string, size: MobileDeImageSize = 1024): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const url = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  const proxied = url.match(PROXY);
  const direct = proxied ? `https://${proxied[1]}` : CDN.test(url) ? url : "";
  if (direct) {
    try {
      const u = new URL(direct);
      if (!isMobileDeAkamaiHost(u.hostname) && u.hostname.toLowerCase() === "img.classistatic.de") {
        u.searchParams.set("rule", `mo-${size}.jpg`);
        return u.toString();
      }
    } catch {
      return "";
    }
    return "";
  }
  if (pointsAtMobileDeAkamai(url)) return "";
  return url;
}
