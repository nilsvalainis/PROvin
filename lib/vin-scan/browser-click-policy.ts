import type { VinScanBrowserId } from "@/lib/vin-scan/catalog";

/**
 * Pārlūka zondes, kurām userscript drīkst nospiest drošo „pārbaudīt” (ne pirkumu).
 * CarVertical šeit NAV: ielogotā kontā „Sākt pārbaudi” tērē kredītus.
 */
export const VIN_SCAN_BROWSER_AUTO_CLICK_IDS = ["autodna_preview", "vininspect", "bid_cars"] as const;

export type VinScanBrowserAutoClickId = (typeof VIN_SCAN_BROWSER_AUTO_CLICK_IDS)[number];

export function vinScanBrowserMayAutoClick(id: string): id is VinScanBrowserAutoClickId {
  return (VIN_SCAN_BROWSER_AUTO_CLICK_IDS as readonly string[]).includes(id);
}

export function vinScanBrowserIsPaidPreview(id: VinScanBrowserId): boolean {
  return id === "carvertical_preview" || id === "autodna_preview";
}
