"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";
import { normalizeSitePath } from "@/lib/site-rail-sections";

/** Sākumlapa, tikai mobilajā: fiksēta pasūtīšanas pill apakšā. */
export function HomeMobileOrderRow() {
  const pathname = usePathname() ?? "";
  const tHero = useTranslations("Hero");
  const p = normalizeSitePath(pathname);
  const isHome = p === "/" || p === "";

  if (!isHome) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden -translate-y-1.5 px-[clamp(1rem,2.6vw,24px)] pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-2"
      aria-hidden={false}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-[min(416px,calc(100vw-2rem))]">
        <Link
          href={orderSectionHref()}
          className="provin-home-pill-cta provin-home-pill-cta--wide z-10 flex min-h-[52px] w-full touch-manipulation items-center justify-center whitespace-normal text-balance text-center text-[clamp(10px,2.95vw,11px)] font-medium leading-snug tracking-[0.12em] shadow-[0_5px_17px_rgba(0,0,0,0.13)] active:scale-95"
        >
          {tHero("heroMobileOrderCta")}
        </Link>
      </div>
    </div>
  );
}
