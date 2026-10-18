"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";

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
