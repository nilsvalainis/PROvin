/** Bust CDN/browser cache when public sample PDFs or page-1 rasters change. */
export const SAMPLE_PUBLIC_ASSET_VERSION = "9";

function sampleAssetPath(href: string): string {
  return (href.split("#")[0] ?? "").split("?")[0] ?? "";
}

/** Publiskā PDF saite bez `?v=` (viena kanoniskā adrese). */
export function samplePdfHref(href: string): string {
  return sampleAssetPath(href);
}

/** Iframe/lightbox: versija tikai keša atjaunošanai, nav indeksējama adrese. */
export function samplePdfViewerHref(href: string): string {
  const path = sampleAssetPath(href);
  return `${path}?v=${SAMPLE_PUBLIC_ASSET_VERSION}`;
}

/**
 * iOS Safari PDF iframes crop/zoom, so mobile preview uses a static page-1 PNG.
 * Assets from scripts/render-soft-page1.mjs (Poppler + shadow lift).
 */
export function sampleMobilePage1Src(pdfHref: string): string | null {
  const path = sampleAssetPath(pdfHref);
  if (!path.toLowerCase().endsWith(".pdf")) return null;
  return path.replace(/\.pdf$/i, "-page1.png");
}
