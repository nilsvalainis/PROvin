/** Mobilā admin čaula (iPhone tab bar + dokumenta ritināšana + PTR). Desktop nemaina. */

export const ADMIN_MAIN_SCROLL_ID = "admin-main-scroll";

/** Peldošā docka iekšējā josla (px). Koncepts: 62 px kapsula. */
export const ADMIN_MOBILE_TABBAR_CONTENT_PX = 62;

/** Augšējā atkāpe (pt-2) + docka augstums; apakšā max(10px, safe-area). */
export const ADMIN_MOBILE_TABBAR_DOCK_CHROME_PX = 74;

export const ADMIN_MOBILE_TABBAR_H_CSS =
  "calc(64px + 16px + env(safe-area-inset-bottom, 0px))" as const;

/**
 * IRISS: josla 14 pt no ekrāna apakšas uz iPhone (safe-area 34 - 20).
 * PRO paliek pie ADMIN_MOBILE_TABBAR_H_CSS.
 */
export const IRISS_MOBILE_TAB_BOTTOM_CSS =
  "max(8px, calc(env(safe-area-inset-bottom, 0px) - 20px))" as const;

export const IRISS_MOBILE_TABBAR_H_CSS =
  "calc(62px + max(8px, calc(env(safe-area-inset-bottom, 0px) - 20px)) + 16px)" as const;

/** iOS 26: stikla kapsula + atsevišķa meklēšanas poga. z-index: tab bar 30. Pozīcija: .admin-m-tabbar-dock. */
export const ADMIN_MOBILE_TABBAR_DOCK_WRAPPER =
  "admin-m-tabbar-dock pointer-events-none fixed z-[30] flex items-center justify-center gap-[12pt] md:hidden";

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

/**
 * PRO lapas no "Vairāk", kurām nav savas mobilās galvenes. Telefonā čaula tām rāda "‹ Atpakaļ".
 * Tikai saraksta lapas; detaļu lapām (`/admin/partneri/[id]` u.c.) ir sava josla.
 */
export const PRO_MOBILE_BACK_PATHS = [
  "/admin/agregatu-zinasanas",
  "/admin/b2b-demo",
  "/admin/blogs",
  "/admin/commission-invoice",
  "/admin/izmaksas",
  "/admin/konsultacijas",
  "/admin/kopsavilkums",
  "/admin/partneri",
  "/admin/statistika",
  "/admin/teksti",
] as const;

export function proMobileNeedsBack(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return (PRO_MOBILE_BACK_PATHS as readonly string[]).includes(p);
}

/** Pogas, saites un lauki - pieskāriens tiem nekad nedrīkst sākt PTR vilkšanu (j37). */
export const PTR_INTERACTIVE_SELECTOR = 'button, a[href], input, textarea, select, [role="button"], [contenteditable="true"]';

type ClosestCapable = { closest(selector: string): unknown };

/**
 * j37: tuvu lapas augšai (kur PTR drīkst sākties) pieskāriens pogai/saitei/laukam gandrīz vienmēr
 * nes nelielu pirksta svārstību - tas tika tulkots par vilkšanu, bīdīja saturu zem pirksta
 * (pieskāriens netrāpīja) un, ja svārstība bija lielāka, izsauca router.refresh() ("lapa pārlādējas").
 * PTR drīkst sākties tikai uz tukša/satura apgabala, nekad uz interaktīva elementa.
 */
export function shouldArmPullToRefresh(target: ClosestCapable | null): boolean {
  if (!target) return true;
  return target.closest(PTR_INTERACTIVE_SELECTOR) == null;
}
