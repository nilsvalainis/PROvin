/**
 * Izsoļu foto URL: labākā izšķirtspēja, normalizēts id, griesti bez kopīga 20-slotu baseina.
 * Tīra loģika, bez tīkla.
 */

export const AUCTION_PHOTO_PER_LOT_MAX = 200;
export const AUCTION_PHOTO_BLOCK_MAX = 500;
export const AUCTION_LOT_MAX = 40;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function normalizeAuctionPhotoId(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const imageKeys =
      u.searchParams.get("imageKeys") || u.searchParams.get("imagekeys") || u.searchParams.get("keys");
    if (imageKeys) return `iaai:${imageKeys.toLowerCase()}`;
    let path = u.pathname.toLowerCase();
    path = path.replace(/\/(thb|hrs|ful|thumb|small|normal|big|hd|full)(?=\/|$)/g, "");
    path = path.replace(/_(thb|hrs|ful|thumb|small|hd|full)(?=\.|$)/g, "");
    path = path.replace(/\.(jpe?g|webp|png|gif)$/i, "");
    return `${host}${path}`;
  } catch {
    return url.toLowerCase();
  }
}

export function scoreAuctionPhotoUrl(url: string): number {
  const u = url.toLowerCase();
  let score = 0;
  if (u.includes("import-motor.com")) score += 100;
  if (/\bbig\b|\/ful\/|_ful|fullsize|\/hd\//.test(u)) score += 50;
  if (/\/hrs\/|_hrs/.test(u)) score += 30;
  if (/exterior|interior/.test(u)) score += 20;
  if (/\/thb\/|_thb|thumb|\/small\//.test(u)) score -= 40;
  try {
    const parsed = new URL(url);
    const w = Number(parsed.searchParams.get("width") || parsed.searchParams.get("w") || 0);
    if (Number.isFinite(w) && w > 0) score += Math.min(80, w / 20);
  } catch {
    /* ignore */
  }
  return score;
}

export function upgradeAuctionPhotoUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (!/iaai\.com$/i.test(u.hostname)) return u.toString();
    if (!/resizer/i.test(u.pathname)) return u.toString();
    const w = Number(u.searchParams.get("width") || 0);
    if (!Number.isFinite(w) || w < 1600) {
      u.searchParams.set("width", "1920");
      u.searchParams.set("height", "1440");
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function pickBestAuctionPhotoUrl(urls: readonly string[]): string {
  const ranked = urls
    .map((raw) => upgradeAuctionPhotoUrl(raw.trim()))
    .filter((u) => u.startsWith("https://"))
    .sort((a, b) => scoreAuctionPhotoUrl(b) - scoreAuctionPhotoUrl(a));
  return ranked[0] ?? "";
}

/** Vienā lotā: vislabākā izšķirtspēja katram normalizētajam id, bez klusās 20-gab. apgriešanas. */
function lotLocalPhotoKey(url: string): string {
  try {
    const path = new URL(url).pathname;
    const stem = (path.split("/").pop() || "")
      .replace(/\.(jpe?g|webp|png|gif)$/i, "")
      .replace(/[_-]?(thb|hrs|ful|thumb|small|hd|full)$/i, "")
      .toLowerCase();
    if (stem && /[-_]\d+$/.test(stem)) return `stem:${stem}`;
  } catch {
    /* ignore */
  }
  return normalizeAuctionPhotoId(url);
}

export function collectBestAuctionPhotoUrls(
  images: unknown,
  max = AUCTION_PHOTO_PER_LOT_MAX,
): { photos: string[]; video: string } {
  const rec = asRecord(images);
  const buckets: unknown[] = [rec.downloaded, rec.big, rec.exterior, rec.interior, rec.normal];
  const best = new Map<string, string>();
  const add = (raw: unknown) => {
    const items = typeof raw === "string" ? [raw] : asArray(raw);
    for (const item of items) {
      const url = upgradeAuctionPhotoUrl(str(item));
      if (!url.startsWith("https://")) continue;
      const id = lotLocalPhotoKey(url);
      if (!id) continue;
      const prev = best.get(id);
      if (!prev || scoreAuctionPhotoUrl(url) > scoreAuctionPhotoUrl(prev)) best.set(id, url);
    }
  };
  for (const bucket of buckets) add(bucket);
  if (best.size === 0) add(rec.small);

  const photos = [...best.values()].slice(0, Math.max(0, max));
  return { photos, video: str(rec.video) || str(rec.external_panorama_url) };
}

export function uniqueBestAuctionPhotoUrls(urls: readonly string[], max = AUCTION_PHOTO_PER_LOT_MAX): string[] {
  const best = new Map<string, string>();
  for (const raw of urls) {
    const url = upgradeAuctionPhotoUrl(String(raw || "").trim());
    if (!url.startsWith("https://")) continue;
    const id = normalizeAuctionPhotoId(url);
    if (!id) continue;
    const prev = best.get(id);
    if (!prev || scoreAuctionPhotoUrl(url) > scoreAuctionPhotoUrl(prev)) best.set(id, url);
  }
  return [...best.values()].slice(0, Math.max(0, max));
}
