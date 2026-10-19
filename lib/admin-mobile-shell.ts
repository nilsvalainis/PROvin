/** Mobilā admin čaula (iPhone tab bar + native `#admin-main-scroll` + PTR). Desktop nemaina. */

export const ADMIN_MAIN_SCROLL_ID = "admin-main-scroll";

/** Peldošā docka iekšējā josla (px). Koncepts: 62 px kapsula. */
export const ADMIN_MOBILE_TABBAR_CONTENT_PX = 62;

/** Augšējā atkāpe (pt-2) + docka augstums; apakšā max(10px, safe-area). */
export const ADMIN_MOBILE_TABBAR_DOCK_CHROME_PX = 74;

export const ADMIN_MOBILE_TABBAR_H_CSS =
  `calc(${ADMIN_MOBILE_TABBAR_DOCK_CHROME_PX}px + max(10px, env(safe-area-inset-bottom, 0px)))` as const;

/** iOS 26: stikla kapsula + atsevišķa meklēšanas poga. z-index: tab bar 30. */
export const ADMIN_MOBILE_TABBAR_DOCK_WRAPPER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-[30] flex items-center justify-center gap-[12pt] px-3 pb-[max(10px,env(safe-area-inset-bottom,0px))] pt-2 md:hidden";

export const ADMIN_MOBILE_TABBAR_DOCK_NAV =
  "am-glass pointer-events-auto relative flex h-[62px] min-w-0 flex-1 items-stretch gap-0 rounded-full px-1.5";

export const ADMIN_MOBILE_Z = {
  content: 0,
  top: 20,
  tab: 30,
  scrim: 40,
  sheet: 50,
} as const;

export const ADMIN_MOBILE_PTR_THRESHOLD_PX = 64;
export const ADMIN_MOBILE_PTR_RUBBER = 0.35;
export const ADMIN_MOBILE_PTR_MAX_PX = 72;
export const ADMIN_MOBILE_PTR_LOCK_PX = 18;
export const ADMIN_MOBILE_PTR_IDLE_PX = 2;
export const ADMIN_MOBILE_PTR_HOLD_MS = 900;
export const ADMIN_MOBILE_MAX_PX = 767;

export const ADMIN_MOBILE_MQ = `(max-width: ${ADMIN_MOBILE_MAX_PX}px)`;

/** Desktop sānjoslas žetoni paliek 45 s. Mobilajā retāk, pēc idle. */
export const ADMIN_DESKTOP_BADGE_POLL_MS = 45_000;
export const ADMIN_MOBILE_BADGE_POLL_MS = 90_000;
/** Pavadzīmes / citi sekundārie fetch pēc pirmā kadra. */
export const ADMIN_MOBILE_SECONDARY_DELAY_MS = 1800;

/** requestIdleCallback, ja ir; citādi timeout. Atgriež atcelšanas funkciju. */
export function scheduleAdminIdleWork(run: () => void, delayMs = ADMIN_MOBILE_SECONDARY_DELAY_MS): () => void {
  if (typeof window === "undefined") return () => undefined;
  const ric = window.requestIdleCallback?.bind(window);
  const cic = window.cancelIdleCallback?.bind(window);
  if (ric && cic) {
    const id = ric(() => run(), { timeout: delayMs });
    return () => cic(id);
  }
  const t = window.setTimeout(run, delayMs);
  return () => window.clearTimeout(t);
}

const ADMIN_DETAIL_PATH = /^\/admin\/(?:iriss\/pasutijumi|orders|konsultacijas|commission-invoice|partneri)\/[^/]+$/;
const IRISS_ORDER_ROOM_PATH = /^\/admin\/iriss\/pasutijumi\/[^/]+$/;

/** Sarakstiem PTR ir ieslēgts. Detaļu lapās tikai IRISS pasūtījuma istabai. */
export function adminMobilePullToRefreshEnabled(pathname: string): boolean {
  if (IRISS_ORDER_ROOM_PATH.test(pathname)) return true;
  if (ADMIN_DETAIL_PATH.test(pathname)) return false;
  return true;
}

export function adminMobilePtrLabel(refreshing: boolean, pullPx: number, threshold = ADMIN_MOBILE_PTR_THRESHOLD_PX): string {
  if (refreshing) return "Atjauno sarakstu…";
  if (pullPx >= threshold) return "Atlaid, lai atjaunotu";
  if (pullPx > 8) return "Velc, lai atjaunotu";
  return "";
}
