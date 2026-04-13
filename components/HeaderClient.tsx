"use client";

import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSiteRailSections, normalizeSitePath, siteRailMenuActiveIndex } from "@/lib/site-rail-sections";

export type HeaderClientProps = {
  orderLabel: string;
  orderHref: string;
  faqHref: string;
  navHome: string;
  faqLabel: string;
  menuOpenLabel: string;
  menuCloseLabel: string;
};

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

function MobileRailMenuIcon({ lineClass }: { lineClass: string }) {
  return (
    <span className="flex flex-col items-center justify-center gap-[5px]" aria-hidden>
      <span className={`h-px w-[22px] ${lineClass}`} />
      <span className={`h-px w-[22px] ${lineClass}`} />
      <span className={`h-px w-[22px] ${lineClass}`} />
    </span>
  );
}

export function HeaderClient({
  orderLabel,
  orderHref,
  faqHref,
  navHome,
  faqLabel,
  menuOpenLabel,
  menuCloseLabel,
}: HeaderClientProps) {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const normalizedPath = normalizeSitePath(pathname);
  const tr = useTranslations("SiteRail");

  const isHome = normalizedPath === "/" || normalizedPath === "";

  /** Lapas ar `SiteSectionRail` (lg+): logo kreisā mala līdz ar „Sākums” uzraksta sākumu (sk. sliedes HTML). */
  const logoAlignWithRailSakums =
    isHome || normalizedPath === "/pasutit" || normalizedPath === "/biezi-jautajumi";

  const railSections = useMemo(() => buildSiteRailSections(locale, normalizedPath), [locale, normalizedPath]);

  const hash = useHash();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) close();
  }, [pathname, hash, open, close]);

  const isFaq = pathname.includes("biezi-jautajumi");
  const isOrderSection = isHome && hash.includes("pasutit");
  const isDarkHeaderSurface = isHome;

  const headerSurface = isDarkHeaderSurface
    ? "border-b border-white/[0.06] bg-transparent pt-[env(safe-area-inset-top,0px)] md:border-b md:border-white/[0.06]"
    : "border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75";

  /** Mājaslapā logo kreisajā malā bez nobīdes pret sliedi; citās „sliežu” lapās — salīdzinājums ar „Sākums”. */
  const logoRailMarginClass =
    logoAlignWithRailSakums && !isHome
      ? "lg:ml-[calc(max(0.5rem,env(safe-area-inset-left,0px))+2.25rem-max(1rem,env(safe-area-inset-left,0px)))]"
      : null;

  const logoClass = [
    isDarkHeaderSurface
      ? "flex min-h-11 min-w-11 shrink-0 items-center text-[28.98px] font-bold tracking-tight text-white transition-colors hover:text-white/90 sm:min-h-0 sm:min-w-0"
      : "flex min-h-11 min-w-11 shrink-0 items-center text-[28.98px] font-bold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent sm:min-h-0 sm:min-w-0",
    logoRailMarginClass,
  ]
    .filter(Boolean)
    .join(" ");

  const navMuted = isDarkHeaderSurface ? "text-white/72" : "text-[#1d1d1f]";

  const orderBtnClass =
    "provin-btn provin-btn--compact inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-[1.125rem] text-[12px] font-bold text-white shadow-[0_0_18px_rgba(0,102,255,0.14)] ring-1 ring-white/10 sm:min-h-9 sm:px-[1.35rem] sm:text-[12px]";

  const navLinkClass = (active: boolean) =>
    [
      "flex min-h-11 items-center rounded-xl px-4 text-lg font-medium tracking-tight transition-colors",
      active ? "text-[#3b82f6]" : `${navMuted} hover:text-provin-accent`,
    ].join(" ");

  const desktopNavClass = (active: boolean) =>
    `text-sm font-medium transition-colors ${active ? "text-provin-accent" : `${navMuted} hover:text-provin-accent`}`;

  const railMenuActive = siteRailMenuActiveIndex(pathname, hash);

  const mobileRailOnDark = isDarkHeaderSurface;

  const railNavLinkClass = (active: boolean) =>
    [
      "flex min-h-12 items-center rounded-xl px-3 text-[15px] font-medium tracking-tight transition-colors",
      active ? "text-[#3b82f6]" : "text-white/80 hover:text-white",
    ].join(" ");

  return (
    <>
      <header className={`sticky top-0 z-[42] isolate w-full ${headerSurface}`}>
        {/* Mobilā „sliežu” lapa: PROVIN kreisajā augšējā stūrī + sliedes izvēlne labajā — tikai &lt; md */}
        {logoAlignWithRailSakums ? (
          <div className="flex w-full items-center justify-between gap-3 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pt-[max(0.25rem,env(safe-area-inset-top,0px))] pb-2 md:hidden">
            <Link
              href="/"
              className={`flex shrink-0 items-center text-[26px] font-bold tracking-tight ${mobileRailOnDark ? "text-white" : "text-[#1d1d1f]"}`}
              aria-label="PROVIN"
            >
              <span className={mobileRailOnDark ? "text-white" : "text-[#1d1d1f]"}>PRO</span>
              <span className="text-provin-accent">VIN</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border-0 bg-transparent p-2 shadow-none outline-none transition-opacity hover:opacity-85 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#0066ff]/40 focus-visible:ring-offset-2 ${mobileRailOnDark ? "text-white focus-visible:ring-offset-[#050505]" : "text-[#1d1d1f] focus-visible:ring-offset-white"}`}
              aria-expanded={open}
              aria-label={menuOpenLabel}
            >
              <MobileRailMenuIcon lineClass={mobileRailOnDark ? "bg-white" : "bg-[#1d1d1f]"} />
            </button>
          </div>
        ) : null}

        <div
          className={`mx-auto flex min-h-12 max-w-[980px] items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:min-h-11 sm:gap-3 sm:px-6 lg:max-w-[1024px] ${logoAlignWithRailSakums ? "hidden md:flex" : ""}`}
        >
          <Link href="/" className={logoClass} aria-label={isHome ? "PROVIN" : "PROVIN.LV"}>
            <span className={isDarkHeaderSurface ? "text-white" : "text-[#1d1d1f]"}>PRO</span>
            <span className="text-provin-accent">VIN</span>
            {isHome ? null : <span className={isDarkHeaderSurface ? "text-white" : "text-[#1d1d1f]"}>.LV</span>}
          </Link>

          <nav className="hidden min-w-0 items-center gap-6 md:flex md:flex-1 md:justify-end">
            <Link href="/" className={desktopNavClass(isHome && !isFaq && !isOrderSection)}>
              {navHome}
            </Link>
            <Link href={faqHref} className={desktopNavClass(isFaq)}>
              {faqLabel}
            </Link>
            <Link href={orderHref} className={orderBtnClass}>
              {orderLabel}
            </Link>
          </nav>

          {!logoAlignWithRailSakums ? (
            <div className="flex items-center gap-2 md:hidden">
              <Link href={orderHref} className={`${orderBtnClass} text-[11px] sm:text-[12px]`}>
                {orderLabel}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={
                  isDarkHeaderSurface
                    ? "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-transparent text-white shadow-none transition hover:border-white/30"
                    : "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#1d1d1f] shadow-sm transition hover:bg-slate-50"
                }
                aria-expanded={open}
                aria-label={menuOpenLabel}
              >
                <Menu className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {logoAlignWithRailSakums && open ? (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={tr("navAria")}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label={menuCloseLabel}
            onClick={close}
          />
          <div className="absolute inset-0 flex flex-col overflow-hidden border-y border-transparent bg-[linear-gradient(90deg,#c0c0c0,#ffffff,#c0c0c0)] p-px shadow-2xl">
            <div className="flex min-h-dvh flex-1 flex-col bg-[#050505] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#3b82f6]/50 hover:text-[#3b82f6]"
                  aria-label={menuCloseLabel}
                >
                  <X className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label={tr("navAria")}>
                {railSections.map((s, i) => (
                  <Link
                    key={s.labelKey}
                    href={s.href}
                    onClick={close}
                    className={railNavLinkClass(i === railMenuActive)}
                    aria-current={i === railMenuActive ? "location" : undefined}
                  >
                    {tr(s.labelKey)}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      ) : null}

      {!logoAlignWithRailSakums && open ? (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={menuOpenLabel}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label={menuCloseLabel}
            onClick={close}
          />
          <div className="absolute inset-0 flex flex-col overflow-hidden border-y border-transparent bg-[linear-gradient(90deg,#c0c0c0,#ffffff,#c0c0c0)] p-px shadow-2xl">
            <div className="flex min-h-dvh flex-1 flex-col bg-[#050505] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#3b82f6]/50 hover:text-[#3b82f6]"
                  aria-label={menuCloseLabel}
                >
                  <X className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <nav className="mt-6 flex flex-1 flex-col gap-2">
                <Link href="/" onClick={close} className={navLinkClass(isHome && !isFaq && !isOrderSection)}>
                  {navHome}
                </Link>
                <Link href={faqHref} onClick={close} className={navLinkClass(isFaq)}>
                  {faqLabel}
                </Link>
                <Link
                  href={orderHref}
                  onClick={close}
                  className={
                    isDarkHeaderSurface
                      ? `${orderBtnClass} mt-2 w-full justify-center text-[11px] font-bold uppercase tracking-[0.06em]`
                      : navLinkClass(isOrderSection)
                  }
                >
                  {orderLabel}
                </Link>
              </nav>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
