/** Bust CDN/browser cache when public sample PDFs or page-1 rasters change. */
export const SAMPLE_PUBLIC_ASSET_VERSION = "9";

function sampleAssetPath(href: string): string {
  return (href.split("#")[0] ?? "").split("?")[0] ?? "";
}

/** Versioned PDF URL for iframe, lightbox and “open in new tab”. */
export function samplePdfHref(href: string): string {
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
  return `${path.replace(/\.pdf$/i, "-page1.png")}?v=${SAMPLE_PUBLIC_ASSET_VERSION}`;
}
