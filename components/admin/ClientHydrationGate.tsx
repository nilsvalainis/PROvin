"use client";

import type { ReactNode } from "react";
import { useClientMounted } from "@/lib/use-client-mounted";

/**
 * Renderē `fallback` līdz pirmam klienta mount.
 * Lietot datumu / naudas formatējumam, lai servera HTML sakristu ar hidrāciju.
 */
export function ClientHydrationGate({
  fallback = "—",
  children,
}: {
  fallback?: ReactNode;
  children: () => ReactNode;
}) {
  const mounted = useClientMounted();
  if (!mounted) return <>{fallback}</>;
  return <>{children()}</>;
}
