"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { faqHashHref, homePath, irissAnchorHref } from "@/lib/paths";
import { ORDER_SECTION_ID } from "@/lib/order-section";

const HOME_SCROLL_IDS = ["home-hero", ORDER_SECTION_ID, "cena", "kas-ir-iriss", "biezi-jautajumi"] as const;

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
 * Kreisā mala — piecu galveno sadaļu plāns ar zilu indikatoru (lg+).
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
    return [
      { href: base === "/" ? "/" : base, labelKey: "sakums" as const },
      { href: "/pasutit", labelKey: "pasutit" as const },
      { href: cenaHref, labelKey: "audits" as const },
      { href: irissAnchorHref(locale), labelKey: "iriss" as const },
      { href: bujHref, labelKey: "buj" as const },
    ] as const;
  }, [locale, normalizedPath]);

  const recomputeActive = useCallback(() => {
    const fromRoute = routeActiveIndex(pathname);
    if (fromRoute !== null) {
      setActive(fromRoute);
      return;
    }
    if (normalizedPath !== "/" && normalizedPath !== "") return;

    const fromHash = activeFromHash(typeof window !== "undefined" ? window.location.hash : hash);
    if (fromHash !== null) {
      setActive(fromHash);
      return;
    }
    setActive(activeFromScroll());
  }, [hash, normalizedPath, pathname]);

  useEffect(() => {
    if (!showRail) return;
    recomputeActive();
    const onScroll = () => {
      if (normalizedPath !== "/" && normalizedPath !== "") return;
      if (activeFromHash(window.location.hash) !== null) return;
      setActive(activeFromScroll());
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recomputeActive);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recomputeActive);
    };
  }, [hash, normalizedPath, pathname, recomputeActive, showRail]);

  useLayoutEffect(() => {
    if (!showRail) return;
    const track = trackRef.current;
    const link = linkRefs.current[active];
    if (!track || !link) return;
    const tr = track.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    const center = lr.top + lr.height / 2 - tr.top;
    const h = 18;
    setDot({ top: Math.max(0, Math.min(center - h / 2, tr.height - h)), height: h });
  }, [active, showRail]);

  if (!showRail) return null;

  return (
    <nav
      className="pointer-events-auto fixed left-[max(0.65rem,env(safe-area-inset-left,0px))] top-1/2 z-40 hidden -translate-y-1/2 lg:flex"
      aria-label={t("navAria")}
    >
      <div className="flex flex-row items-stretch gap-3">
        <div ref={trackRef} className="relative w-1 self-stretch">
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
        <ul className="flex flex-col gap-4 py-0.5">
          {sections.map((s, i) => (
            <li key={s.labelKey}>
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
