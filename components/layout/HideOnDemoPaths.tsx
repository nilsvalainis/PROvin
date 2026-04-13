"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

function normalizePathname(pathname: string) {
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/**
 * Demo lapām — bez globālā headera (sānu sliede un demo UI paliek).
 * Sākumlapā header tagad tiek rādīts (mobilais PROVIN + izvēlne).
 */
export function HideOnDemoPaths({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const normalized = normalizePathname(pathname);
  if (normalized === "/demo" || normalized.startsWith("/demo/")) return null;
  return children;
}
