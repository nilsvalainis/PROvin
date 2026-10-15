/** Known auction CDNs. next/image is used only for these hosts; others stay a lazy img. */
export const IRISS_LISTING_IMAGE_HOST_SUFFIXES = [
  "auto1.com",
  "openlane.eu",
  "openlane.com",
  "autobid.de",
  "autobid.eu",
  "ecarstrade.com",
] as const;

const WIDTH_QUERY_KEYS = ["w", "width", "imwidth", "mw", "maxwidth"] as const;

export function listingImageHostnameAllowed(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return IRISS_LISTING_IMAGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function shrinkListingImageUrl(raw: string, maxWidth: number): string {
  const url = raw.trim();
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const target = Math.max(64, Math.round(maxWidth));
  for (const key of WIDTH_QUERY_KEYS) {
    const cur = parsed.searchParams.get(key);
    if (!cur) continue;
    const n = Number.parseInt(cur, 10);
    if (Number.isFinite(n) && n > target) parsed.searchParams.set(key, String(target));
  }
  parsed.pathname = parsed.pathname.replace(
    /\/imagecache\/(?:hd|xl|xxl|l|large|full|original|m|medium)\//i,
    "/imagecache/s/",
  );
  parsed.pathname = parsed.pathname.replace(/(\d{3,4})x(\d{3,4})/g, (token, w, h) => {
    const width = Number(w);
    const height = Number(h);
    if (!Number.isFinite(width) || width <= target) return token;
    const scale = target / width;
    return `${target}x${Math.max(1, Math.round(height * scale))}`;
  });
  parsed.pathname = parsed.pathname.replace(/width_(\d{3,4})/gi, (token, w) => {
    const width = Number(w);
    if (!Number.isFinite(width) || width <= target) return token;
    return `width_${target}`;
  });
  return parsed.toString();
}

export function listingDisplayImageUrl(input: {
  url?: string;
  thumbUrl?: string;
  thumbnailUrl?: string;
  imageThumbUrl?: string;
  maxWidth: number;
}): string {
  const explicit = [input.thumbUrl, input.thumbnailUrl, input.imageThumbUrl].map((s) => (s ?? "").trim()).find(Boolean);
  if (explicit && input.maxWidth <= 640) return explicit;
  return shrinkListingImageUrl(input.url ?? "", input.maxWidth);
}
