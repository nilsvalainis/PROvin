"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { faqHashHref, homePath, irissAnchorHref } from "@/lib/paths";
import { ORDER_SECTION_ID } from "@/lib/order-section";

const HOME_SCROLL_IDS = ["home-hero", ORDER_SECTION_ID, "cena", "kas-ir-iriss", "biezi-jautajumi", "kontakti"] as const;

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

function activeFromHash(raw: string): number | null {
  const h = raw.replace(/^#/, "").toLowerCase();
  if (!h) return null;
  if (h === "home-hero") return 0;
  if (h === ORDER_SECTION_ID || h === "order-form" || h === "site-content") return 1;
  if (h === "cena") return 2;
  if (h.startsWith("kas-ir-iriss") || h.startsWith("kas-stav")) return 3;
  if (h === "biezi-jautajumi") return 4;
  if (h === "kontakti") return 5;
  return null;
}

function activeFromScroll(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  /* Lapas augšā bez ritināšanas — vienmēr „Sākums”, lai nesāktu uz „Pasūtīt” no mērķa līnijas noapaļošanas. */
  if (window.scrollY < 8) return 0;
  const line = window.scrollY + window.innerHeight * 0.22;
  let idx = 0;
  for (let i = 0; i < HOME_SCROLL_IDS.length; i++) {
    const el = document.getElementById(HOME_SCROLL_IDS[i]);
    if (!el) continue;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (top <= line + 1) idx = i;
  }
  return idx;
}

function routeActiveIndex(pathname: string | null | undefined): number | null {
  if (pathname == null) return null;
  const p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (p === "/pasutit") return 1;
  if (p === "/biezi-jautajumi") return 4;
  return null;
}

function normalizePath(pathname: string | null | undefined): string {
  if (pathname == null) return "";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/**
 * Kreisā navigācija — mierīgā režīmā gandrīz „pazūd”, pie tuvināšanās / tastatūras
 * maigs gradients, lasāmāki teksti, slīde un zils indikators (lg+).
 */
export function SiteSectionRail() {
  const t = useTranslations("SiteRail");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const hash = useHash();
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [dot, setDot] = useState({ top: 0, height: 16 });

  const normalizedPath = useMemo(() => normalizePath(pathname), [pathname]);
  const showRail =
    normalizedPath === "/" ||
    normalizedPath === "" ||
    normalizedPath === "/pasutit" ||
    normalizedPath === "/biezi-jautajumi" ||
    normalizedPath === "/demo" ||
    normalizedPath.startsWith("/demo/");

  const sections = useMemo(() => {
    const base = homePath(locale);
    const cenaHref = base === "/" ? "/#cena" : `${base}#cena`;
    const bujHref = normalizedPath === "/biezi-jautajumi" ? "/biezi-jautajumi" : faqHashHref(locale);
    const kontaktiHref = base === "/" ? "/#kontakti" : `${base}#kontakti`;
    return [
      { href: base === "/" ? "/" : base, labelKey: "sakums" as const },
      { href: "/pasutit", labelKey: "pasutit" as const },
      { href: cenaHref, labelKey: "audits" as const },
      { href: irissAnchorHref(locale), labelKey: "iriss" as const },
      { href: bujHref, labelKey: "buj" as const },
      { href: kontaktiHref, labelKey: "kontakti" as const },
    ] as const;
  }, [locale, normalizedPath]);

  const recomputeActive = useCallback(() => {
    const fromRoute = routeActiveIndex(pathname);
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
    const fromHash = activeFromHash(typeof window !== "undefined" ? window.location.hash : hash);
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
      const link = linkRefs.current[active];
      if (!track || !link) return;
      const tr = track.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      const center = lr.top + lr.height / 2 - tr.top;
      const h = 16;
      setDot({ top: Math.max(0, Math.min(center - h / 2, tr.height - h)), height: h });
    };
    updateDot();
    window.addEventListener("resize", updateDot);
    return () => window.removeEventListener("resize", updateDot);
  }, [active, showRail]);

  if (!showRail) return null;

  const linkBase =
    "group/link flex max-w-[9.5rem] items-start gap-2.5 text-left text-[9px] font-medium uppercase leading-snug tracking-[0.17em] outline-none transition-[color,opacity] duration-500 ease-[cubic-bezier(0.33,0.86,0.2,1)] motion-reduce:transition-none lg:max-w-[10.5rem] lg:text-[10px] lg:tracking-[0.19em]";

  return (
    <nav
      className="group/rail pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(0.5rem,env(safe-area-inset-left,0px))] top-[max(1rem,env(safe-area-inset-top,0px))] z-40 hidden min-h-0 w-max flex-col pl-1 lg:flex"
      aria-label={t("navAria")}
    >
      {/* Plašāks „tuvuma” lauks + diskrēts fons tikai pie hover / tastatūras */}
      <div
        className="pointer-events-none absolute -inset-x-2 -inset-y-6 left-0 z-0 rounded-r-[1.85rem] bg-gradient-to-r from-black/50 via-black/14 to-transparent opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.33,0.86,0.2,1)] group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 motion-reduce:transition-none"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 w-max flex-1 flex-row items-stretch gap-3.5 pl-0.5">
        <div ref={trackRef} className="relative h-full min-h-0 w-0.5 shrink-0">
          <div
            className="absolute inset-y-1.5 left-1/2 w-px -translate-x-1/2 bg-white/[0.06] transition-[background-color] duration-700 ease-out group-hover/rail:bg-white/[0.11] group-focus-within/rail:bg-white/[0.11]"
            aria-hidden
          />
          <div
            className="absolute left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-[#0066ff] opacity-90 shadow-[0_0_10px_rgba(0,102,255,0.28)] transition-[top,box-shadow,opacity,height] duration-700 ease-[cubic-bezier(0.33,0.86,0.2,1)] motion-reduce:!transition-none group-hover/rail:opacity-100 group-hover/rail:shadow-[0_0_14px_rgba(0,102,255,0.38)]"
            style={{
              top: dot.top,
              height: dot.height,
              transition:
                "top 520ms cubic-bezier(0.33, 0.86, 0.2, 1), height 360ms cubic-bezier(0.33, 0.86, 0.2, 1), box-shadow 600ms ease-out, opacity 600ms ease-out",
            }}
            aria-hidden
          />
        </div>
        <ul className="flex h-full min-h-0 flex-1 flex-col">
          {sections.map((s, i) => {
            const isActive = i === active;
            return (
              <li key={s.labelKey} className="flex min-h-0 flex-1 flex-col justify-center">
                <span
                  ref={(el) => {
                    linkRefs.current[i] = el;
                  }}
                  className="block min-w-0"
                >
                  <Link
                    href={s.href}
                    className={`${linkBase} ${
                      isActive
                        ? "text-white"
                        : "text-white/[0.22] group-hover/rail:text-white/[0.42] group-focus-within/rail:text-white/[0.42] hover:text-white/85"
                    } focus-visible:text-white focus-visible:ring-1 focus-visible:ring-[#0066ff]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
                    aria-current={isActive ? "location" : undefined}
                  >
                    <span
                      className={`mt-[0.4em] h-1 w-1 shrink-0 rounded-full bg-[#0066ff] transition-[opacity,transform,box-shadow] duration-500 ease-[cubic-bezier(0.33,0.86,0.2,1)] motion-reduce:transition-none ${
                        isActive
                          ? "scale-100 opacity-100 shadow-[0_0_7px_rgba(0,102,255,0.55)]"
                          : "scale-[0.85] opacity-0 group-hover/link:scale-100 group-hover/link:opacity-70 group-focus-visible/link:scale-100 group-focus-visible/link:opacity-85"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0">{t(s.labelKey)}</span>
                  </Link>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
