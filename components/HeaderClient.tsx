"use client";

import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";

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
  const normalizedPath =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  /** Lapas ar `SiteSectionRail` (lg+): logo kreisā mala līdz ar „Sākums” uzraksta sākumu (sk. sliedes HTML). */
  const logoAlignWithRailSakums =
    normalizedPath === "/" ||
    normalizedPath === "" ||
    normalizedPath === "/pasutit" ||
    normalizedPath === "/biezi-jautajumi";
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

  const isHome = pathname === "/" || pathname === "";
  const isFaq = pathname.includes("biezi-jautajumi");
  const isOrderSection = isHome && hash.includes("pasutit");
  const isDarkHeaderSurface = isHome;

  const headerSurface = isDarkHeaderSurface
    ? "border-b border-white/[0.06] bg-transparent pt-[env(safe-area-inset-top,0px)]"
    : "border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75";

  const logoClass = [
    isDarkHeaderSurface
      ? "flex min-h-11 min-w-11 shrink-0 items-center text-[24.15px] font-bold tracking-tight text-white transition-colors hover:text-white/90 sm:min-h-0 sm:min-w-0"
      : "flex min-h-11 min-w-11 shrink-0 items-center text-[24.15px] font-bold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent sm:min-h-0 sm:min-w-0",
    logoAlignWithRailSakums
      ? "lg:ml-[calc(max(0.5rem,env(safe-area-inset-left,0px))+2.25rem-max(1rem,env(safe-area-inset-left,0px)))]"
      : null,
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

  return (
    <>
      <header className={`sticky top-0 z-[32] isolate ${headerSurface}`}>
        <div className="mx-auto flex min-h-12 max-w-[980px] items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:min-h-11 sm:gap-3 sm:px-6 lg:max-w-[1024px]">
          <Link href="/" className={logoClass} aria-label="PROVIN.LV">
            <span className={isDarkHeaderSurface ? "text-white" : "text-[#1d1d1f]"}>PRO</span>
            <span className="text-provin-accent">VIN</span>
            <span className={isDarkHeaderSurface ? "text-white" : "text-[#1d1d1f]"}>.LV</span>
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
        </div>
      </header>

      {open ? (
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
