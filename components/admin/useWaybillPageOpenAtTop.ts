"use client";

import { useEffect } from "react";
import { ADMIN_MAIN_SCROLL_ID } from "@/lib/admin-mobile-shell";

/**
 * Pavadzīmes jāatver augšā (jaunākās augšā), nevis ritinātas uz leju (Nils 23.10).
 * Cēlonis: pārlūks pēc pārlādes / atgriešanās atjauno iepriekšējo ritināšanu (bieži lapas apakšā pie "Man vajag VPN"),
 * kamēr saraksti vēl ielādējas. Izņēmums: saite uz konkrētu pavadzīmi (?wb=...), tad to rāda PavadzimeSearchFocus.
 */
export function waybillPageOpensAtTop(search: string): boolean {
  return !new URLSearchParams(search).get("wb")?.trim();
}

export function useWaybillPageOpenAtTop(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    if (waybillPageOpensAtTop(window.location.search)) {
      window.scrollTo(0, 0);
      const main = document.getElementById(ADMIN_MAIN_SCROLL_ID);
      if (main) main.scrollTop = 0;
    }
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);
}
