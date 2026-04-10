"use client";

import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { MagneticSpring } from "@/components/home/MagneticSpring";
import { computeHomeCinematicFrame } from "@/lib/home-cinematic-scroll";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const pathname = usePathname();
  const hash = useHash();
  const [open, setOpen] = useState(false);
  const [homeSilver01, setHomeSilver01] = useState(0);

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

  const homeScrollRaf = useRef(0);

  useEffect(() => {
    if (!isHome) {
      setHomeSilver01(0);
      return;
    }
    const tick = () => {
      homeScrollRaf.current = 0;
      const vh = window.innerHeight || 1;
      const { silver01 } = computeHomeCinematicFrame(
        window.scrollY || window.pageYOffset,
        vh,
        document.documentElement.scrollHeight,
      );
      setHomeSilver01((prev) => (Math.abs(prev - silver01) < 0.015 ? prev : silver01));
    };
    const schedule = () => {
      if (homeScrollRaf.current) return;
      homeScrollRaf.current = window.requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (homeScrollRaf.current) cancelAnimationFrame(homeScrollRaf.current);
    };
  }, [isHome]);

  const elevated = isHome && homeSilver01 > 0.06;
  const silvered = isHome && homeSilver01 > 0.4;

  const headerSurface = !isHome
    ? "border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75"
    : !elevated
      ? "border-b border-transparent bg-transparent pt-[env(safe-area-inset-top,0px)] backdrop-blur-none"
      : silvered
        ? "border-b border-white/20 bg-white/12 pt-[env(safe-area-inset-top,0px)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/10"
        : "border-b border-white/10 bg-black/40 pt-[env(safe-area-inset-top,0px)] backdrop-blur-2xl supports-[backdrop-filter]:bg-black/35";

  const logoClass = !isHome
    ? "flex min-h-11 min-w-11 items-center text-[21px] font-semibold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent sm:min-h-0 sm:min-w-0"
    : silvered
      ? "flex min-h-11 min-w-11 items-center text-[21px] font-semibold tracking-tight text-[#0a0a0f] transition-colors hover:text-provin-accent sm:min-h-0 sm:min-w-0"
      : "flex min-h-11 min-w-11 items-center text-[21px] font-semibold tracking-tight text-white transition-colors hover:text-white/90 sm:min-h-0 sm:min-w-0";

  const navMuted = !isHome ? "text-[#1d1d1f]" : silvered ? "text-[#0a0a0f]" : "text-white/90";

  const orderBtnClass = !isHome
    ? "provin-btn provin-btn--compact inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.1)] sm:min-h-10 sm:px-5"
    : silvered
      ? "provin-btn provin-btn--compact inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(0,0,0,0.12)] sm:min-h-10 sm:px-5"
      : "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-white/55 bg-transparent px-4 text-[13px] font-semibold text-white shadow-none backdrop-blur-sm transition hover:border-white/80 hover:bg-white/5 sm:min-h-10 sm:px-5";

  const navLinkClass = (active: boolean) =>
    [
      "flex min-h-11 items-center rounded-xl px-4 text-lg font-medium tracking-tight transition-colors",
      active ? "text-[#3b82f6]" : `${navMuted} hover:text-provin-accent`,
    ].join(" ");

  return (
    <>
      <header className={`sticky top-0 z-40 ${headerSurface}`}>
        <div className="mx-auto flex min-h-12 max-w-[980px] items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:min-h-11 sm:gap-3 sm:px-6 lg:max-w-[1024px]">
          <Link href="/" className={logoClass}>
            <span>PRO</span>
            <span className="text-provin-accent">VIN</span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-6 md:flex md:flex-1 md:justify-end">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${isHome && !isFaq && !isOrderSection ? "text-provin-accent" : `${navMuted} hover:text-provin-accent`}`}
            >
              {navHome}
            </Link>
            <Link
              href={faqHref}
              className={`text-sm font-medium transition-colors ${isFaq ? "text-provin-accent" : `${navMuted} hover:text-provin-accent`}`}
            >
              {faqLabel}
            </Link>
            {isHome ? (
              <MagneticSpring className="inline-flex shrink-0" strength={0.28}>
                <Link href={orderHref} className={orderBtnClass}>
                  {orderLabel}
                </Link>
              </MagneticSpring>
            ) : (
              <Link href={orderHref} className={orderBtnClass}>
                {orderLabel}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            {isHome ? (
              <MagneticSpring className="inline-flex shrink-0" strength={0.28}>
                <Link href={orderHref} className={`${orderBtnClass} text-[12px]`}>
                  {orderLabel}
                </Link>
              </MagneticSpring>
            ) : (
              <Link href={orderHref} className={`${orderBtnClass} text-[12px]`}>
                {orderLabel}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={
                isHome && !silvered
                  ? "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/10"
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
            <div className="flex min-h-dvh flex-1 flex-col bg-[#050505]/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-2xl">
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
                <Link href={orderHref} onClick={close} className={navLinkClass(isOrderSection)}>
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
