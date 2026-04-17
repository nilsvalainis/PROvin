"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SITE_THEME_STORAGE_KEY,
  applySiteThemeToDocument,
  readSiteTheme,
  writeSiteTheme,
  type SiteThemeMode,
} from "@/lib/site-theme";

export type SiteThemeContextValue = {
  theme: SiteThemeMode;
  setTheme: (mode: SiteThemeMode) => void;
  toggleTheme: () => void;
};

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);

export function useSiteTheme(): SiteThemeContextValue {
  const v = useContext(SiteThemeContext);
  if (!v) throw new Error("useSiteTheme must be used within SiteThemeProvider");
  return v;
}

export function SiteThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: ReactNode;
  initialTheme?: SiteThemeMode;
}) {
  /**
   * Svarīgi hydration stabilitātei:
   * serveris vienmēr renderē ar "dark", tāpēc klienta pirmajai renderēšanai
   * jābūt identiskai. Reālo izvēli no localStorage ielasām useEffect.
   */
  const [theme, setThemeState] = useState<SiteThemeMode>(initialTheme);

  /** Vienota sinkronizācija: state -> `<html data-site-theme>` + localStorage. */
  useEffect(() => {
    applySiteThemeToDocument(theme);
    writeSiteTheme(theme);
  }, [theme]);

  useEffect(() => {
    const attr = typeof document !== "undefined" ? document.documentElement.getAttribute("data-site-theme") : null;
    const t = attr === "light" || attr === "dark" ? attr : readSiteTheme();
    setThemeState(t);
  }, [initialTheme]);

  const setTheme = useCallback((mode: SiteThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      return prev === "dark" ? "light" : "dark";
    });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SITE_THEME_STORAGE_KEY || !e.newValue) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}
