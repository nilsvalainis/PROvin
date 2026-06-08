"use client";

import { useEffect, type ReactNode } from "react";
import { applySiteThemeToDocument, writeSiteTheme } from "@/lib/site-theme";

/** Vienmēr tumšā tēma — sinhronizē `<html data-site-theme>` un localStorage. */
export function SiteThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applySiteThemeToDocument("dark");
    writeSiteTheme("dark");
  }, []);

  return children;
}
