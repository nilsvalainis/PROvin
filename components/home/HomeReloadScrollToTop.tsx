"use client";

import { usePathname } from "@/i18n/navigation";
import { useLenis } from "lenis/react";
import { useEffect, useLayoutEffect } from "react";
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

/** Tailwind `md` — mobilais skats, kur pārlūks bieži atjauno scrollY pēc refresh. */
function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

/**
 * Ja URL enkurs norāda uz saturu zem hero, pēc pārlādes atstājam pārlūka scroll restaurāciju.
 * Hero zonas enkuri (#pasutit, #home-hero, u. c.) — mobilajā pēc refresh ritinām uz lapas augšu.
 */
function shouldPreserveDeepLinkAnchorOnReload(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash.replace(/^#/, "").toLowerCase();
  if (!h) return false;
  if (h === "cena" || h.startsWith("cena-")) return true;
  if (h === "site-content" || h.startsWith("site-content")) return true;
  if (h.startsWith("kas-ir-iriss") || h.startsWith("kas-stav")) return true;
  if (h.includes("biezi-jautajumi")) return true;
  if (h === "kontakti") return true;
  if (h.startsWith("provin-select")) return true;
  if (h.startsWith("demo-")) return true;
  return false;
}

function hardScrollTop(lenis: ReturnType<typeof useLenis>) {
  if (lenis) {
    lenis.scrollTo(0, { immediate: true });
  } else {
    window.scrollTo(0, 0);
  }
  if (typeof document !== "undefined") {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

/**
 * Pilnā lapas pārlādē (F5) pārlūks bieži atjauno iepriekšējo scrollY — lietotājs nonāk vidū / citā sadaļā.
 * Uz sākumlapu bez URL enkura vienmēr atgriežam virs hero; ar #… atstājam enkura uzvedību (piem. #pasutit).
 * Mobilajā: papildu aizkaves pret Safari/Chrome scroll restaurāciju (izņemot dziļos enkurus).
 */
export function HomeReloadScrollToTop() {
  const pathname = usePathname() ?? "";
  const lenis = useLenis();

  useLayoutEffect(() => {
    const path = normalizeSitePath(pathname);
    if (path !== "/" && path !== "") return;
    if (!isReloadNavigation()) return;

    const mobile = isMobileViewport();
    if (mobile) {
      if (shouldPreserveDeepLinkAnchorOnReload()) return;
    } else if (hasScrollHash()) {
      return;
    }

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const go = () => {
      hardScrollTop(lenis);
    };

    go();
    requestAnimationFrame(() => {
      go();
      requestAnimationFrame(go);
    });
  }, [pathname, lenis]);

  useEffect(() => {
    const path = normalizeSitePath(pathname);
    if (path !== "/" && path !== "") return;
    if (!isReloadNavigation()) return;
    if (!isMobileViewport()) return;
    if (shouldPreserveDeepLinkAnchorOnReload()) return;

    const go = () => {
      hardScrollTop(lenis);
    };

    const t0 = window.setTimeout(go, 0);
    const t1 = window.setTimeout(go, 50);
    const t2 = window.setTimeout(go, 150);
    const t3 = window.setTimeout(go, 400);

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) go();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, lenis]);

  return null;
}
