"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";
import { normalizeSitePath } from "@/lib/site-rail-sections";

/**
 * Globāla „Pasūtīt” — labais augšējais stūris, pill estētika kā mobilā pasūtīšanas josla.
 * Slēpts demo lapās un tur, kur jau ir sliede / headera izvēlne (sākums, pasūtīt, BUJ).
 */
export function SiteOrderCtaPin() {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const t = useTranslations("Hero");
  const p = normalizeSitePath(pathname);
  const hidePin =
    p === "/demo" || p.startsWith("/demo/") || p === "/" || p === "" || p === "/pasutit" || p === "/biezi-jautajumi";

  if (hidePin) return null;

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
