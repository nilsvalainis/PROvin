"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

/**
 * Globāla „PASŪTĪT” — fiksēta augšējā kreisajā stūrī (neatkarīgi no ritināšanas).
 * `lg+`: nobīdīta pa labi no vertikālās navigācijas, lai nepārklājas.
 */
export function SiteOrderCtaPin() {
  const locale = useLocale();
  const t = useTranslations("Hero");

  return (
    <Link
      href={orderSectionHref(locale)}
      aria-label={t("cta")}
      className="provin-btn provin-btn--compact fixed left-[max(0.65rem,env(safe-area-inset-left,0px))] top-[max(0.55rem,calc(env(safe-area-inset-top,0px)+0.35rem))] z-[45] inline-flex min-h-10 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-[#0066ff] px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_0_18px_rgba(0,102,255,0.22)] ring-1 ring-white/10 transition-[filter,transform] active:brightness-95 sm:min-h-[2.65rem] sm:px-5 sm:text-[12px] sm:tracking-[0.09em] lg:left-[max(0.75rem,calc(env(safe-area-inset-left,0px)+12.75rem))]"
    >
      <span className="whitespace-nowrap">{t("orderPin")}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-95 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}
