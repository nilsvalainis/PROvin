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

function routeActiveIndex(pathname: string): number | null {
  const p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (p === "/pasutit") return 1;
  if (p === "/biezi-jautajumi") return 4;
  return null;
}

function normalizePath(pathname: string) {
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/**
 * Kreisā mala — galveno sadaļu plāns (vienāds vertikālais sadalījums) ar zilu indikatoru (lg+).
 */
export function SiteSectionRail() {
  const t = useTranslations("SiteRail");
  const locale = useLocale();
  const pathname = usePathname();
  const hash = useHash();
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [dot, setDot] = useState({ top: 0, height: 18 });

  const normalizedPath = useMemo(() => normalizePath(pathname), [pathname]);
  const showRail = normalizedPath === "/" || normalizedPath === "" || normalizedPath === "/pasutit" || normalizedPath === "/biezi-jautajumi";

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
      const h = 18;
      setDot({ top: Math.max(0, Math.min(center - h / 2, tr.height - h)), height: h });
    };
    updateDot();
    window.addEventListener("resize", updateDot);
    return () => window.removeEventListener("resize", updateDot);
  }, [active, showRail]);

  if (!showRail) return null;

  return (
    <nav
      className="pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(0.65rem,env(safe-area-inset-left,0px))] top-[max(1rem,env(safe-area-inset-top,0px))] z-40 hidden min-h-0 w-max flex-col lg:flex"
      aria-label={t("navAria")}
    >
      <div className="flex h-full min-h-0 w-max flex-1 flex-row items-stretch gap-3">
        <div ref={trackRef} className="relative h-full min-h-0 w-1 shrink-0">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.14]" aria-hidden />
          <div
            className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[#0066ff] shadow-[0_0_14px_rgba(0,102,255,0.45)] motion-reduce:!transition-none"
            style={{
              top: dot.top,
              height: dot.height,
              transition: "top 280ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            aria-hidden
          />
        </div>
        <ul className="flex h-full min-h-0 flex-1 flex-col">
          {sections.map((s, i) => (
            <li key={s.labelKey} className="flex min-h-0 flex-1 flex-col justify-center">
              <Link
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                href={s.href}
                className={`block max-w-[9.5rem] text-left text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] transition-colors motion-reduce:transition-none lg:max-w-[10.5rem] lg:text-[11px] lg:tracking-[0.16em] ${
                  i === active ? "text-white" : "text-white/38 hover:text-white/55"
                }`}
                aria-current={i === active ? "location" : undefined}
              >
                {t(s.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
