"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

function normalizeAdminPath(href: string): string {
  const raw = href.trim();
  if (!raw) return "/";
  if (/^https?:\/\//i.test(raw)) {
    try {
      return normalizeAdminPath(new URL(raw).pathname);
    } catch {
      return "/";
    }
  }
  const noQuery = raw.split("?")[0]?.split("#")[0] ?? raw;
  const t = noQuery.trim();
  if (!t || t === "/") return "/";
  return t.replace(/\/+$/, "") || "/";
}

type AdminNavInteractionValue = {
  beginNav: (href: string) => void;
  isPending: (href: string) => boolean;
};

const AdminNavInteractionContext = createContext<AdminNavInteractionValue | null>(null);

export function AdminNavInteractionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const current = normalizeAdminPath(pathname);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const t = window.setTimeout(() => setPendingHref(null), 12000);
    return () => window.clearTimeout(t);
  }, [pendingHref]);

  const beginNav = useCallback(
    (href: string) => {
      if (normalizeAdminPath(href) === current) {
        setPendingHref(null);
        return;
      }
      setPendingHref(href);
    },
    [current],
  );

  const isPending = useCallback(
    (href: string) =>
      pendingHref !== null && normalizeAdminPath(pendingHref) === normalizeAdminPath(href),
    [pendingHref],
  );

  const value = useMemo(() => ({ beginNav, isPending }), [beginNav, isPending]);

  return <AdminNavInteractionContext.Provider value={value}>{children}</AdminNavInteractionContext.Provider>;
}

export function useAdminNavInteraction() {
  return useContext(AdminNavInteractionContext);
}
