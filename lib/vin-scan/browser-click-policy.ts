import type { VinScanBrowserId } from "@/lib/vin-scan/catalog";

/**
 * Pārlūka zondes, kurām userscript drīkst nospiest drošo „pārbaudīt” (ne pirkumu).
 * AutoDNA / CarVertical VIN SCAN vairs nav: pirkums paliek pasūtījuma darba zonā.
 */
export const VIN_SCAN_BROWSER_AUTO_CLICK_IDS = [
  "bid_cars",
  "plc_auction",
  "lt_itpr",
  "nicb",
  "bidfax",
  "poctra",
] as const;

export type VinScanBrowserAutoClickId = (typeof VIN_SCAN_BROWSER_AUTO_CLICK_IDS)[number];

export function vinScanBrowserMayAutoClick(id: string): id is VinScanBrowserAutoClickId {
  return (VIN_SCAN_BROWSER_AUTO_CLICK_IDS as readonly string[]).includes(id);
}

export function vinScanBrowserIsPaidPreview(_id: VinScanBrowserId): boolean {
  return false;
}
