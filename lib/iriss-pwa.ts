export const IRISS_PWA_NAME = "IRISS";
export const IRISS_PWA_SCOPE = "/admin/iriss/";
export const IRISS_PWA_START_URL = "/admin/iriss/pasutijumi";
export const IRISS_PWA_SW_PATH = "/admin/iriss/sw.js";
export const IRISS_PWA_MANIFEST_PATH = "/admin/iriss/manifest.webmanifest";
/** PWA / Safari theme-color = IRISS --bg-base (gaišais un tumšais). */
export const IRISS_PWA_THEME_COLOR = "#E9ECF1";
export const IRISS_PWA_THEME_COLOR_DARK = "#060607";

export function irissPwaThemeColor(theme: "light" | "dark"): string {
  return theme === "dark" ? IRISS_PWA_THEME_COLOR_DARK : IRISS_PWA_THEME_COLOR;
}
