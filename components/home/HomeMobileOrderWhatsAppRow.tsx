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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex md:hidden -translate-y-1.5 items-center gap-2.5 px-3 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-2"
      aria-hidden={false}
    >
      <div className="min-w-0 flex-1 pointer-events-auto flex justify-center pr-2">
        <Link
          href={orderSectionHref(locale)}
          className="provin-home-pill-cta provin-home-pill-cta--fit pointer-events-auto min-h-[50px] max-w-[min(100%,calc(100vw-5.25rem))] touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
        >
          {tHero("heroMobileOrderCta")}
        </Link>
      </div>
      <a
        href={whatsappChatUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="provin-home-pill-cta provin-home-pill-cta--fab pointer-events-auto shrink-0 shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
        aria-label={tMisc("whatsappFab")}
      >
        <WhatsAppBrandIcon className="h-[1.49rem] w-[1.49rem]" />
      </a>
    </div>
  );
}
