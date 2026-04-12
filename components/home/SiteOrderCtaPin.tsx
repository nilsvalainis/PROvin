"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

/**
 * Globāla „PASŪTĪT” — fiksēta lapas labajā augšējā stūrī (neatkarīgi no ritināšanas).
 */
export function SiteOrderCtaPin() {
  const locale = useLocale();
  const t = useTranslations("Hero");

  return (
    <Link
      href={orderSectionHref(locale)}
      aria-label={t("cta")}
      className="provin-btn provin-btn--compact fixed right-[max(0.65rem,env(safe-area-inset-right,0px))] top-[max(0.55rem,calc(env(safe-area-inset-top,0px)+0.35rem))] z-[45] inline-flex min-h-9 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-[#0066ff] px-[0.9rem] py-[0.45rem] text-center text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_0_18px_rgba(0,102,255,0.22)] ring-1 ring-white/10 transition-[filter,transform] active:brightness-95 sm:min-h-[2.385rem] sm:px-[1.125rem] sm:text-[11px] sm:tracking-[0.09em]"
    >
      <span className="whitespace-nowrap">{t("orderPin")}</span>
      <ArrowRight className="h-3 w-3 shrink-0 opacity-95 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}
