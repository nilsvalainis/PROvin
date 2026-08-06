"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";
import { shouldHideSiteOrderCtaPin } from "@/lib/site-order-cta-pin";

/**
 * Globāla „Pasūtīt” viewport pin (labais augšējais stūris).
 * Nav montēts layoutā — atstāts, ja kādreiz vajag atkārtoti ieslēgt uz lapām bez headera rail.
 * Glass `position: relative` pārspēj Tailwind `fixed`, tāpēc poza tikai caur `--viewport-pin` + inline.
 */
export function SiteOrderCtaPin() {
  const pathname = usePathname() ?? "";
  const t = useTranslations("Hero");

  if (shouldHideSiteOrderCtaPin(pathname)) return null;

  return (
    <Link
      href={orderSectionHref()}
      aria-label={t("cta")}
      style={{
        position: "fixed",
        top: "max(1.25rem, env(safe-area-inset-top, 0px))",
        right: "max(1.25rem, env(safe-area-inset-right, 0px))",
        zIndex: 48,
      }}
      className="provin-home-pill-cta provin-home-pill-cta--fit provin-home-pill-cta--viewport-pin touch-manipulation whitespace-nowrap shadow-[0_5px_17px_rgba(0,0,0,0.13)] active:scale-95"
    >
      {t("orderPin")}
    </Link>
  );
}
