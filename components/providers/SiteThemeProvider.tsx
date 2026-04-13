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

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SiteThemeMode>(() =>
    typeof window === "undefined" ? "dark" : readSiteTheme(),
  );

  useEffect(() => {
    const t = readSiteTheme();
    setThemeState(t);
    applySiteThemeToDocument(t);
  }, []);

  const setTheme = useCallback((mode: SiteThemeMode) => {
    setThemeState(mode);
    applySiteThemeToDocument(mode);
    writeSiteTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applySiteThemeToDocument(next);
      writeSiteTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SITE_THEME_STORAGE_KEY || !e.newValue) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        setThemeState(e.newValue);
        applySiteThemeToDocument(e.newValue);
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
