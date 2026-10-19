"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { adminMobileThemeColor } from "@/lib/admin-mobile-collapse";
import { irissPwaThemeColor } from "@/lib/iriss-pwa";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import type { AdminWorkspaceId } from "@/lib/admin-chrome-attrs";

function subscribeMobileViewport(onStoreChange: () => void): () => void {
  const mq = window.matchMedia(ADMIN_MOBILE_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

/**
 * Telefonu skats (<=767px). SSR un hidrācija = false, lai desktop koks paliek kā bija.
 * Pēc hidrācijas mobilajā kļūst true.
 */
export function useAdminMobileViewport(): boolean {
  return useSyncExternalStore(
    subscribeMobileViewport,
    () => window.matchMedia(ADMIN_MOBILE_MQ).matches,
    () => false,
  );
}

/** True after first client effect, so mobile vs desktop ir zināms pirms sekundārajiem fetch. */
export function useAdminClientReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}

/**
 * Light/dark uz `.admin-m[data-theme]` / `[data-admin-theme]`.
 * Nav lietotāja slēdža: seko `prefers-color-scheme`.
 */
export function useAdminMobileColorScheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    () => "light",
  );
}

/** Safari theme-color seko admin tēmai (ne paliek pie pirmā meta). IRISS = --bg-base. */
export function useSyncAdminMobileThemeColor(
  theme: "light" | "dark",
  workspace: AdminWorkspaceId = "pro",
): void {
  useEffect(() => {
    const color = workspace === "iriss" ? irissPwaThemeColor(theme) : adminMobileThemeColor(theme);
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      const el = document.createElement("meta");
      el.setAttribute("name", "theme-color");
      el.setAttribute("content", color);
      document.head.appendChild(el);
      return;
    }
    metas.forEach((el) => el.setAttribute("content", color));
  }, [theme, workspace]);
}
