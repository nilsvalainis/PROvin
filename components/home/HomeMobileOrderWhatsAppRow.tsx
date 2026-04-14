"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { whatsappChatUrl } from "@/lib/contact";
import { orderSectionHref } from "@/lib/paths";
import { normalizeSitePath } from "@/lib/site-rail-sections";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";

/**
 * Sākumlapa, tikai mobilajā: pasūtīšanas pill + WhatsApp viena horizontālā rindā —
 * tās pašas `provin-home-pill-cta` klases un ēna kā `WhatsAppFab`.
 */
export function HomeMobileOrderWhatsAppRow() {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const tHero = useTranslations("Hero");
  const tMisc = useTranslations("Misc");
  const p = normalizeSitePath(pathname);
  const isHome = p === "/" || p === "";

  if (!isHome) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden -translate-y-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-2"
      aria-hidden={false}
    >
      <div className="pointer-events-auto relative mx-auto min-h-[50px] w-full max-w-[100vw] px-3">
        <Link
          href={orderSectionHref(locale)}
          className="provin-home-pill-cta provin-home-pill-cta--fit absolute left-1/2 top-1/2 z-10 min-h-[50px] max-w-[min(100%,calc(100vw-4.75rem))] -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
        >
          {tHero("heroMobileOrderCta")}
        </Link>
        <a
          href={whatsappChatUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="provin-home-pill-cta provin-home-pill-cta--fab absolute right-[max(0.5rem,env(safe-area-inset-right,0px))] top-1/2 z-20 -translate-y-1/2 shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
          aria-label={tMisc("whatsappFab")}
        >
          <WhatsAppBrandIcon className="h-[1.49rem] w-[1.49rem]" />
        </a>
      </div>
    </div>
  );
}
