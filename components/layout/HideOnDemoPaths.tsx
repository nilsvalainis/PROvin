"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

function normalizePathname(pathname: string) {
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/**
 * Demo lapām (`/demo`, `/demo/...`) — bez globālā headera un fiksētās „Pasūtīt” pogas; paliek sānu sliede.
 */
export function HideOnDemoPaths({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const normalized = normalizePathname(pathname);
  if (normalized === "/demo" || normalized.startsWith("/demo/")) return null;
  return children;
}
