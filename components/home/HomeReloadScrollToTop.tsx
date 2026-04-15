"use client";

import { usePathname } from "@/i18n/navigation";
import { useLenis } from "lenis/react";
import { useLayoutEffect } from "react";
import { normalizeSitePath } from "@/lib/site-rail-sections";

function isReloadNavigation(): boolean {
  if (typeof performance === "undefined") return false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type) return nav.type === "reload";
  const legacy = (performance as Performance & { navigation?: { type: number } }).navigation;
  return legacy?.type === 1;
}

function hasScrollHash(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.location.hash.replace(/^#/, "").trim());
}

/**
 * Pilnā lapas pārlādē (F5) pārlūks bieži atjauno iepriekšējo scrollY — lietotājs nonāk vidū / citā sadaļā.
 * Uz sākumlapu bez URL enkura vienmēr atgriežam virs hero; ar #… atstājam enkura uzvedību (piem. #pasutit).
 */
export function HomeReloadScrollToTop() {
  const pathname = usePathname() ?? "";
  const lenis = useLenis();

  useLayoutEffect(() => {
    const path = normalizeSitePath(pathname);
    if (path !== "/" && path !== "") return;
    if (!isReloadNavigation()) return;
    if (hasScrollHash()) return;

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const go = () => {
      if (lenis) {
        lenis.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo(0, 0);
      }
    };

    go();
    requestAnimationFrame(go);
  }, [pathname, lenis]);

  return null;
}
