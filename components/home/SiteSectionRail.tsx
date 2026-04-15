"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  SITE_RAIL_HOME_SCROLL_IDS,
  buildSiteRailSections,
  normalizeSitePath,
  siteRailActiveFromHash,
  siteRailRouteActiveIndex,
} from "@/lib/site-rail-sections";

const HOME_SCROLL_IDS = SITE_RAIL_HOME_SCROLL_IDS;

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

function activeFromScroll(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  /* Lapas augšā bez ritināšanas — vienmēr „Sākums”, lai nesāktu uz „Pasūtīt” no mērķa līnijas noapaļošanas. */
  if (window.scrollY < 8) return 0;
  /**
   * Mērķa līnija ≈ zem sticky galvenes (`railTopClass` / `HeaderClient` ~3.25rem + atstarpe) —
   * ne tikai % no viewport, lai aktīvā sadaļa labāk sakrīt ar redzamo saturu.
   */
  const line = window.scrollY + Math.min(88, window.innerHeight * 0.26);
  let idx = 0;
  for (let i = 0; i < HOME_SCROLL_IDS.length; i++) {
    const el = document.getElementById(HOME_SCROLL_IDS[i]);
    if (!el) continue;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (top <= line + 1) idx = i;
  }
  const doc = document.documentElement;
  const scrollBottomGap = doc.scrollHeight - window.scrollY - window.innerHeight;
  const lastId = HOME_SCROLL_IDS[HOME_SCROLL_IDS.length - 1];
  if (scrollBottomGap <= 6 && lastId && document.getElementById(lastId)) {
    idx = HOME_SCROLL_IDS.length - 1;
  }
  return idx;
}

/**
 * Kreisā navigācija (lg+): vertikālā ass, zilie punkti un etiķetes — teksts vienmēr redzams;
 * uz sliedes hover — nedaudz spilgtāka krāsa un vieglšķībe.
 */
export function SiteSectionRail() {
  const t = useTranslations("SiteRail");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const hash = useHash();
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const railListRef = useRef<HTMLUListElement>(null);
  /** Šūna ar punktu (w-3) — vertikālais centrs sakrīt ar sliedes assi; nav atkarīgs no etiķetes plūsmas. */
  const dotCellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dot, setDot] = useState({ top: 0, height: 16 });

  const normalizedPath = useMemo(() => normalizeSitePath(pathname), [pathname]);
  const showRail =
    normalizedPath === "/" ||
    normalizedPath === "" ||
    normalizedPath === "/pasutit" ||
    normalizedPath === "/biezi-jautajumi" ||
    normalizedPath === "/demo" ||
    normalizedPath.startsWith("/demo/");

  const sections = useMemo(() => buildSiteRailSections(locale, normalizedPath), [locale, normalizedPath]);

  const recomputeActive = useCallback(() => {
    const fromRoute = siteRailRouteActiveIndex(pathname);
    if (fromRoute !== null) {
      setActive(fromRoute);
      return;
    }
    if (normalizedPath !== "/" && normalizedPath !== "") return;
    setActive(activeFromScroll());
  }, [normalizedPath, pathname]);

  /** Hash tikai hashchange / sākumā; scroll vienmēr atjauno pēc pozīcijas (neiesalst uz #). */
  const applyHashIfPresent = useCallback(() => {
    if (normalizedPath !== "/" && normalizedPath !== "") return;
    const fromHash = siteRailActiveFromHash(typeof window !== "undefined" ? window.location.hash : hash);
    if (fromHash !== null) setActive(fromHash);
    else setActive(activeFromScroll());
  }, [hash, normalizedPath]);

  useEffect(() => {
    if (!showRail) return;
    recomputeActive();
    let raf = 0;
    const onScroll = () => {
      if (normalizedPath !== "/" && normalizedPath !== "") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActive(activeFromScroll()));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", recomputeActive);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", recomputeActive);
    };
  }, [normalizedPath, pathname, recomputeActive, showRail]);

  useEffect(() => {
    if (!showRail) return;
    applyHashIfPresent();
  }, [applyHashIfPresent, hash, showRail]);

  useLayoutEffect(() => {
    if (!showRail) return;
    const updateDot = () => {
      const track = trackRef.current;
      const cell = dotCellRefs.current[active];
      if (!track || !cell) return;
      const tr = track.getBoundingClientRect();
      const cr = cell.getBoundingClientRect();
      const center = cr.top + cr.height / 2 - tr.top;
      const h = 16;
      setDot({ top: Math.max(0, Math.min(center - h / 2, tr.height - h)), height: h });
    };
    updateDot();
    window.addEventListener("resize", updateDot);
    const track = trackRef.current;
    const list = railListRef.current;
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateDot());
      if (track) ro.observe(track);
      if (list) ro.observe(list);
    }
    return () => {
      window.removeEventListener("resize", updateDot);
      ro?.disconnect();
    };
  }, [active, showRail, sections.length]);

  if (!showRail) return null;

  const linkBase =
    "group/link relative flex max-w-none min-h-0 flex-1 flex-row items-stretch text-left text-[9px] font-medium uppercase leading-snug tracking-[0.17em] outline-none transition-[color] duration-200 ease-out motion-reduce:transition-none lg:text-[10px] lg:tracking-[0.19em]";

  /**
   * Etiķete `absolute` — neanimējam `max-width` (izraisa reflow un „lēcienus” ar punktiem).
   * Tikai `opacity` + `transform` uz GPU.
   * Vertikālā ass (`site-rail-axis`) nav `<Link>` iekšā — tāpēc `group-hover/rail`, lai uzkļūšana uz sliedi rāda uzrakstus;
   * `group-focus-visible/link` — fokusā tikai attiecīgās rindas etiķete (tastatūra).
   */
  const railLabelClass =
    "home-rail-label pointer-events-none absolute left-0 top-1/2 z-[2] max-w-[min(10.25rem,min(28vw,26vmin))] -translate-y-1/2 translate-x-0 whitespace-normal break-words text-pretty text-left opacity-100 transition-[color,transform] duration-200 ease-out motion-reduce:transition-none group-hover/rail:translate-x-0.5 group-focus-visible/link:translate-x-0.5";

  /**
   * `top` zem sticky header (z-42): citādi zilais sliežu punkts redzams caur caurspīdīgo hero headeri.
   * ≈ safe-area + header rinda (`min-h-12` / `sm:min-h-11`) + neliela atstarpe.
   */
  const railTopClass =
    "top-[max(1rem,calc(env(safe-area-inset-top,0px)+3.25rem))]";

  return (
    <nav
      className={`site-section-rail group/rail pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(0.5rem,env(safe-area-inset-left,0px))] ${railTopClass} z-40 hidden min-h-0 min-w-0 w-max max-w-[min(15.75rem,min(34vw,30vmin))] cursor-pointer flex-col overflow-x-clip overflow-y-auto overscroll-contain pl-1 lg:flex`}
      aria-label={t("navAria")}
    >
      {/* Plašāks „tuvuma” lauks + diskrēts fons tikai pie hover / tastatūras */}
      <div
        className="pointer-events-none absolute -inset-x-2 -inset-y-6 left-0 z-0 rounded-r-[1.85rem] bg-gradient-to-r from-black/50 via-black/14 to-transparent opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.33,0.86,0.2,1)] group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 motion-reduce:transition-none"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 min-w-0 w-max max-w-full flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-row items-stretch gap-2.5 pl-0.5">
          <div ref={trackRef} className="relative h-full min-h-0 w-3 shrink-0">
            <div
              className="site-rail-axis absolute inset-y-1.5 left-1/2 z-0 w-px -translate-x-1/2 bg-white/[0.11] shadow-[0_0_14px_rgba(0,102,255,0.12)] transition-[background-color,box-shadow] duration-700 ease-out group-hover/rail:bg-white/[0.16] group-hover/rail:shadow-[0_0_18px_rgba(0,102,255,0.2)] group-focus-within/rail:bg-white/[0.16] group-focus-within/rail:shadow-[0_0_18px_rgba(0,102,255,0.2)]"
              aria-hidden
            />
            <div
              className="site-rail-dot absolute left-1/2 top-0 w-[2px] rounded-full bg-[#0066ff] opacity-95 shadow-[0_0_12px_rgba(0,102,255,0.45)] will-change-transform motion-reduce:!transition-none group-hover/rail:opacity-100 group-hover/rail:shadow-[0_0_16px_rgba(0,102,255,0.55)]"
              style={{
                height: dot.height,
                transform: `translate3d(-50%, ${dot.top}px, 0)`,
                transition:
                  "transform 0.78s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease-out, opacity 0.4s ease-out",
              }}
              aria-hidden
            />
          </div>
          <ul
            ref={railListRef}
            className="flex h-full min-h-0 min-w-[min(10.25rem,min(28vw,26vmin))] flex-1 flex-col"
          >
            {sections.map((s, i) => {
              const isActive = i === active;
              return (
                <li key={s.labelKey} className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <Link
                    href={s.href}
                    className={`${linkBase} w-full min-w-0 pr-1 ${
                      isActive
                        ? "text-white"
                        : "text-[#c9ced9] group-hover/rail:text-white group-focus-within/rail:text-white hover:text-white"
                    } focus-visible:text-white focus-visible:ring-1 focus-visible:ring-[#0066ff]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
                    aria-current={isActive ? "location" : undefined}
                  >
                    <div
                      ref={(el) => {
                        dotCellRefs.current[i] = el;
                      }}
                      className="flex w-3 shrink-0 flex-col items-center justify-center"
                      aria-hidden
                    >
                      <span
                        className={`h-1 w-1 shrink-0 rounded-full bg-[#0066ff] transition-[opacity,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
                          isActive
                            ? "opacity-100 shadow-[0_0_8px_rgba(0,102,255,0.65)]"
                            : "opacity-[0.4] shadow-[0_0_5px_rgba(0,102,255,0.35)] group-hover/rail:opacity-[0.85] group-hover/rail:shadow-[0_0_8px_rgba(0,102,255,0.45)] group-focus-visible/link:opacity-90"
                        }`}
                      />
                    </div>
                    <div className="relative min-w-0 flex-1 self-stretch">
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
