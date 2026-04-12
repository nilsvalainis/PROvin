"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

/**
 * Globāla „Pasūtīt” — labais augšējais stūris, tā pati pill estētika kā `WhatsAppFab`.
 */
export function SiteOrderCtaPin() {
  const locale = useLocale();
  const t = useTranslations("Hero");

  return (
    <Link
      href={orderSectionHref(locale)}
      aria-label={t("cta")}
      className="provin-home-pill-cta provin-home-pill-cta--fit fixed right-[max(1.25rem,env(safe-area-inset-right,0px))] top-[max(1.25rem,env(safe-area-inset-top,0px))] z-[48] touch-manipulation whitespace-nowrap shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
    >
      {t("orderPin")}
    </Link>
  );
}
