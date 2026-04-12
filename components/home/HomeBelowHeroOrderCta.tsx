import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

/**
 * „Pasūtīt” — zem hero, uzreiz pēc „Turpināt”, virs How it works.
 */
export function HomeBelowHeroOrderCta({ locale, label }: { locale: string; label: string }) {
  return (
    <div className="relative z-10 flex w-full justify-center px-4 pb-2 pt-1.5 sm:px-8 sm:pb-3 sm:pt-2">
      <Link
        href={orderSectionHref(locale)}
        className="provin-btn provin-btn--compact inline-flex w-auto max-w-[min(100%,calc(100vw-2rem))] min-h-12 touch-manipulation items-center justify-center rounded-full bg-[#0066ff] px-6 py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_0_22px_rgba(0,102,255,0.2)] ring-1 ring-white/10 active:brightness-95 sm:min-h-[3.25rem] sm:px-8 sm:text-[14px] sm:tracking-[0.07em]"
      >
        <span className="inline-flex items-center justify-center gap-2 text-center">
          <span className="min-w-0 whitespace-nowrap">{label}</span>
          <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
        </span>
      </Link>
    </div>
  );
}
