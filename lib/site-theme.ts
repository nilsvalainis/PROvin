export const SITE_THEME_STORAGE_KEY = "provin-site-theme";

export type SiteThemeMode = "light" | "dark";

export function readSiteTheme(): SiteThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(SITE_THEME_STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function writeSiteTheme(mode: SiteThemeMode) {
  try {
    localStorage.setItem(SITE_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function applySiteThemeToDocument(mode: SiteThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-site-theme", mode);
}
