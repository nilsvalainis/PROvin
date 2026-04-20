"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  buildSiteRailSections,
  getSiteRailHomeScrollIds,
  normalizeSitePath,
  siteRailActiveFromHash,
  siteRailRouteActiveIndex,
} from "@/lib/site-rail-sections";

function useHash(): string {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(typeof window !== "undefined" ? window.location.hash : "");
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return hash;
}

/** Fallback, ja IO vēl nav datu (tukši elementi / īpaši īss skats). */
function activeFromScrollLine(scrollIds: readonly string[]): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  if (window.scrollY < 8) return 0;
  const line = window.scrollY + Math.min(88, window.innerHeight * 0.26);
  let idx = 0;
  for (let i = 0; i < scrollIds.length; i++) {
    const el = document.getElementById(scrollIds[i]);
    if (!el) continue;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (top <= line + 1) idx = i;
  }
  const doc = document.documentElement;
  const scrollBottomGap = doc.scrollHeight - window.scrollY - window.innerHeight;
  const lastId = scrollIds[scrollIds.length - 1];
  if (scrollBottomGap <= 6 && lastId && document.getElementById(lastId)) {
    return scrollIds.length - 1;
  }
  return idx;
}

/**
 * Kreisā navigācija (lg+): ass + zilie punkti katrā rindā (fiksēti pret rindu, bez slīdoša transform).
 * Aktīvā sadaļa: IntersectionObserver + apakšas snap; hash maršrutiem — prioritāte.
 */
export function SiteSectionRail() {
  const t = useTranslations("SiteRail");
  const pathname = usePathname() ?? "";
  const hash = useHash();
  const [active, setActive] = useState(0);
  const [isRailOpen, setIsRailOpen] = useState(false);
  const scrollIds = useMemo(() => [...getSiteRailHomeScrollIds()], []);
  const ratioRef = useRef<number[]>(new Array(scrollIds.length).fill(0));

  const normalizedPath = useMemo(() => normalizeSitePath(pathname), [pathname]);
  const showRail =
    normalizedPath === "/" ||
    normalizedPath === "" ||
    normalizedPath === "/pasutit" ||
    normalizedPath === "/biezi-jautajumi";

  const sections = useMemo(() => buildSiteRailSections(normalizedPath), [normalizedPath]);

  const pickActiveIndex = useCallback((): number | null => {
    if (typeof window === "undefined") return null;
    const fromRoute = siteRailRouteActiveIndex(pathname);
    if (fromRoute !== null) return fromRoute;
    if (normalizedPath !== "/" && normalizedPath !== "") return null;

    const h = window.location.hash;
    if (h) {
      const fromHash = siteRailActiveFromHash(h);
      if (fromHash !== null) return fromHash;
    }

    const doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 10) {
      return scrollIds.length - 1;
    }
    if (window.scrollY < 6) return 0;

    const ratios = ratioRef.current;
    let best = 0;
    let bestR = -1;
    for (let i = 0; i < ratios.length; i++) {
      if (ratios[i] > bestR) {
        bestR = ratios[i];
        best = i;
      }
    }
    if (bestR > 0.02) return best;
    return activeFromScrollLine(scrollIds);
  }, [normalizedPath, pathname, scrollIds]);

  const flush = useCallback(() => {
    const idx = pickActiveIndex();
    if (idx !== null) setActive(idx);
  }, [pickActiveIndex]);

  useEffect(() => {
    if (!showRail) return;
    flush();
  }, [flush, hash, showRail]);

  useEffect(() => {
    if (!showRail) return;
    const fromRoute = siteRailRouteActiveIndex(pathname);
    if (fromRoute !== null) {
      setActive(fromRoute);
      return;
    }
    if (normalizedPath !== "/" && normalizedPath !== "") return;

    const ratios = ratioRef.current;
    ratios.fill(0);

    const elements = scrollIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) {
      flush();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          const i = scrollIds.indexOf(id);
          if (i >= 0) ratios[i] = entry.intersectionRatio;
        }
        flush();
      },
      {
        root: null,
        rootMargin: "-22% 0px -42% 0px",
        threshold: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.65, 0.8, 1],
      },
    );

    for (const el of elements) {
      io.observe(el);
    }

    const onScrollOrResize = () => {
      requestAnimationFrame(flush);
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    document.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", onScrollOrResize);
    requestAnimationFrame(flush);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      document.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [flush, normalizedPath, pathname, showRail, scrollIds]);

  if (!showRail) return null;

  const linkBase =
    "group/link relative flex max-w-none min-h-0 flex-1 flex-row items-stretch text-left text-[9px] font-medium uppercase leading-snug tracking-[0.17em] outline-none transition-all duration-300 ease-in-out motion-reduce:transition-none lg:text-[10px] lg:tracking-[0.19em]";

  const railLabelClass = "home-rail-label z-[2] inline-block text-left leading-none";

  const railTopClass =
    "top-[max(1rem,calc(env(safe-area-inset-top,0px)+3.25rem))]";

  return (
    <nav
      className={`site-section-rail pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(0.5rem,env(safe-area-inset-left,0px))] ${railTopClass} z-40 hidden min-h-0 min-w-0 w-max cursor-pointer flex-col overflow-y-auto overscroll-contain pl-1 lg:flex`}
      aria-label={t("navAria")}
      data-rail-open={isRailOpen ? "true" : "false"}
      onMouseEnter={() => setIsRailOpen(true)}
      onMouseLeave={() => setIsRailOpen(false)}
      onFocusCapture={() => setIsRailOpen(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!next || !event.currentTarget.contains(next as Node)) {
          setIsRailOpen(false);
        }
      }}
    >
      <div
        className="site-section-rail__scrim pointer-events-none absolute -inset-x-2 -inset-y-6 left-0 z-0 rounded-r-[1.85rem] bg-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-row items-stretch gap-2.5 pl-0.5">
          <div className="relative h-full min-h-0 w-3 shrink-0">
            <div
              className="site-rail-axis absolute inset-y-1.5 left-1/2 z-0 w-px -translate-x-1/2"
              aria-hidden
            />
          </div>
          <ul className="site-section-rail__links flex min-h-0 min-w-0 shrink-0 grow-0 flex-col">
            {sections.map((s, i) => {
              const isActive = i === active;
              return (
                <li key={`${s.labelKey}:${s.href}`} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                  <Link
                    href={s.href}
                    className={`${linkBase} site-section-rail__link w-full min-w-0 pr-1 ${
                      isActive ? "text-white" : "text-[#c9ced9]"
                    } focus-visible:text-white focus-visible:ring-1 focus-visible:ring-[#0066ff]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
                    aria-current={isActive ? "location" : undefined}
                  >
                    <div
                      className="relative flex w-3 shrink-0 flex-col items-center justify-center self-stretch"
                      aria-hidden
                    >
                      <span
                        className={`absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0066ff] transition-[opacity,box-shadow] duration-300 ease-in-out motion-reduce:transition-none ${
                          isActive
                            ? "opacity-100 shadow-[0_0_8px_rgba(0,102,255,0.65)]"
                            : "opacity-[0.4] shadow-[0_0_5px_rgba(0,102,255,0.35)] group-focus-visible/link:opacity-90"
                        }`}
                      />
                    </div>
                    <div className="relative flex min-w-0 flex-1 items-center self-stretch">
                      <span className={railLabelClass}>{t(s.labelKey)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
