export const SITE_THEME_STORAGE_KEY = "provin-site-theme";
export const SITE_THEME_COOKIE_KEY = "provin-site-theme";

export type SiteThemeMode = "dark";

export function readSiteTheme(): SiteThemeMode {
  return "dark";
}

export function writeSiteTheme(_mode?: SiteThemeMode) {
  try {
    localStorage.setItem(SITE_THEME_STORAGE_KEY, "dark");
    if (typeof document !== "undefined") {
      document.cookie = `${SITE_THEME_COOKIE_KEY}=dark; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}

export function applySiteThemeToDocument(_mode?: SiteThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-site-theme", "dark");
}
