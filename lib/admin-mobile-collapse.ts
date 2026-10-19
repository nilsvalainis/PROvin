export type AdminMobileChromeMode = "expanded" | "collapsed";

const TOP_PX = 10;
const DIR_PX = 8;

/** Sticky compact josla paliek; čipi paslēpjas ritinot uz leju. */
export function nextAdminMobileChromeMode(
  scrollY: number,
  deltaY: number,
  prev: AdminMobileChromeMode,
): AdminMobileChromeMode {
  if (!Number.isFinite(scrollY) || scrollY < TOP_PX) return "expanded";
  if (deltaY > DIR_PX) return "collapsed";
  if (deltaY < -DIR_PX) return "expanded";
  return prev;
}

export const ADMIN_MOBILE_CHROME_COMPACT_PX = 44;
export const ADMIN_MOBILE_CHROME_FULL_MAX_PX = 150;
export const ADMIN_MOBILE_LIST_PAD_BOTTOM_CSS =
  "calc(64px + 16px + env(safe-area-inset-bottom, 0px))" as const;

export const ADMIN_MOBILE_THEME_COLOR_LIGHT = "#F2F2F7";
export const ADMIN_MOBILE_THEME_COLOR_DARK = "#000000";

export function adminMobileThemeColor(theme: "light" | "dark"): string {
  return theme === "dark" ? ADMIN_MOBILE_THEME_COLOR_DARK : ADMIN_MOBILE_THEME_COLOR_LIGHT;
}

export function formatAdminMobileBadgeCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n > 99 ? "99+" : String(Math.floor(n));
}
