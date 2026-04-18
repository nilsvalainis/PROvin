"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";
import { normalizeSitePath } from "@/lib/site-rail-sections";

/** Sākumlapa, tikai mobilajā: fiksēta pasūtīšanas pill apakšā. */
export function HomeMobileOrderRow() {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const tHero = useTranslations("Hero");
  const p = normalizeSitePath(pathname);
  const isHome = p === "/" || p === "";

  if (!isHome) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden -translate-y-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-2"
      aria-hidden={false}
    >
      <div className="pointer-events-auto relative mx-auto flex min-h-[50px] w-full max-w-[100vw] justify-center px-3">
        <Link
          href={orderSectionHref(locale)}
          className="provin-home-pill-cta provin-home-pill-cta--fit z-10 min-h-[50px] max-w-[min(100%,calc(100vw-2rem))] touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_5px_17px_rgba(0,0,0,0.13)] active:scale-95"
        >
          {tHero("heroMobileOrderCta")}
        </Link>
      </div>
    </div>
  );
}
