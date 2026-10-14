/** Mobilā admin čaula (iPhone tab bar + native `#admin-main-scroll` + PTR). Desktop nemaina. */

export const ADMIN_MAIN_SCROLL_ID = "admin-main-scroll";

/** iOS tab bar saturs (bez Home Indicator). */
export const ADMIN_MOBILE_TABBAR_CONTENT_PX = 49;

export const ADMIN_MOBILE_TABBAR_H_CSS =
  `calc(${ADMIN_MOBILE_TABBAR_CONTENT_PX}px + env(safe-area-inset-bottom, 0px))` as const;

export const ADMIN_MOBILE_PTR_THRESHOLD_PX = 64;
export const ADMIN_MOBILE_PTR_RUBBER = 0.35;
export const ADMIN_MOBILE_PTR_MAX_PX = 72;
export const ADMIN_MOBILE_PTR_LOCK_PX = 18;
export const ADMIN_MOBILE_PTR_IDLE_PX = 2;
export const ADMIN_MOBILE_PTR_HOLD_MS = 900;
export const ADMIN_MOBILE_MAX_PX = 767;

export const ADMIN_MOBILE_MQ = `(max-width: ${ADMIN_MOBILE_MAX_PX}px)`;

export function adminMobilePtrLabel(refreshing: boolean, pullPx: number, threshold = ADMIN_MOBILE_PTR_THRESHOLD_PX): string {
  if (refreshing) return "Atjauno sarakstu…";
  if (pullPx >= threshold) return "Atlaid, lai atjaunotu";
  if (pullPx > 8) return "Velc, lai atjaunotu";
  return "";
}
