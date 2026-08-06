"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";
import { shouldHideSiteOrderCtaPin } from "@/lib/site-order-cta-pin";

/**
 * Globāla „Pasūtīt” — labais augšējais stūris, pill estētika kā mobilā pasūtīšanas josla.
 * Slēpts tur, kur jau ir sliede / headera izvēlne (sākums, pasūtīt, pakalpojumi, BUJ).
 */
export function SiteOrderCtaPin() {
  const pathname = usePathname() ?? "";
  const t = useTranslations("Hero");

  if (shouldHideSiteOrderCtaPin(pathname)) return null;

  return (
    <Link
      href={orderSectionHref()}
      aria-label={t("cta")}
      className="provin-home-pill-cta provin-home-pill-cta--fit provin-home-pill-cta--viewport-pin touch-manipulation whitespace-nowrap shadow-[0_5px_17px_rgba(0,0,0,0.13)] active:scale-95"
    >
      {t("orderPin")}
    </Link>
  );
}
