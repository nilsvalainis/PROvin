/** Mobilā admin čaula (iPhone tab bar + native `#admin-main-scroll` + PTR). Desktop nemaina. */

export const ADMIN_MAIN_SCROLL_ID = "admin-main-scroll";

/** Peldošā docka iekšējā josla (px). */
export const ADMIN_MOBILE_TABBAR_CONTENT_PX = 52;

/** Augšējā atkāpe (pt-2) + docka augstums; apakšā max(10px, safe-area). */
export const ADMIN_MOBILE_TABBAR_DOCK_CHROME_PX = 60;

export const ADMIN_MOBILE_TABBAR_H_CSS =
  `calc(${ADMIN_MOBILE_TABBAR_DOCK_CHROME_PX}px + max(10px, env(safe-area-inset-bottom, 0px)))` as const;

/** Variants 2: peldošais stikla dokss (mockup). */
export const ADMIN_MOBILE_TABBAR_DOCK_WRAPPER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom,0px))] pt-2 md:hidden";

export const ADMIN_MOBILE_TABBAR_DOCK_NAV =
  "pointer-events-auto flex h-[52px] w-full max-w-[366px] items-stretch rounded-[1.15rem] bg-[rgba(255,255,255,0.72)] p-1 shadow-[0_6px_24px_rgba(15,23,42,0.12)] backdrop-blur-[14px]";

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
