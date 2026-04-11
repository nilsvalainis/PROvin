import { ArrowRight } from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroServiceGrid } from "@/components/HeroServiceGrid";
import { approvedByIrissSignatureHeroClass, heroH1BluePillClass } from "@/lib/home-layout";
import { orderSectionHref } from "@/lib/paths";

type Pillar = { title: string; body: string };

export async function Hero() {
  const t = await getTranslations("Hero");
  const locale = await getLocale();
  const messages = await getMessages();
  const pillars = (messages as { Hero: { pillars: Pillar[] } }).Hero.pillars;

  return (
    <section>
      <div
        className="mx-auto flex min-w-0 max-w-[min(100%,53.76rem)] flex-col text-center max-sm:min-h-0 max-sm:justify-start max-sm:gap-8 max-sm:px-5 max-sm:pb-10 max-sm:pt-[max(1.75rem,env(safe-area-inset-top))] sm:min-h-[100svh] sm:justify-between sm:gap-6 sm:px-4 sm:pb-4 sm:pt-[max(0.85rem,env(safe-area-inset-top))] md:min-h-0 md:gap-12 md:pb-6 md:pt-14 md:text-center"
      >
          <header className="flex shrink-0 flex-col items-center gap-6 sm:gap-7 md:gap-8">
            <p className={approvedByIrissSignatureHeroClass} aria-label={t("approved")}>
              {t("approved")}
            </p>

            <h1 className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[28px] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]">
              <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
                <span className={heroH1BluePillClass}>{t("h1Vin")}</span>
                <span className="text-[#1d1d1f]">{t("h1Un")}</span>
                <span className={heroH1BluePillClass}>{t("h1Sludinajuma")}</span>
              </span>
              <span className="mt-0.5 block text-provin-accent sm:mt-1">{t("h1Line2")}</span>
            </h1>

            <p
              className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance`}
            >
              {t("h2")}
            </p>
          </header>

          <div className="min-h-0 shrink">
            <HeroServiceGrid items={pillars} />
          </div>

          <div className="shrink-0 space-y-4 md:space-y-5">
            <p className="mx-auto max-w-[52ch] text-balance text-center text-[12px] font-medium leading-snug text-[#5c5d62] sm:text-[13px] sm:leading-relaxed">
              {t("trustHeadline")}
            </p>

            <div className="flex flex-col items-center">
              <Link
                href={orderSectionHref(locale)}
                className="provin-btn provin-btn--compact inline-flex min-h-[43px] w-auto max-w-[min(100%,17.5rem)] items-center justify-center gap-2 rounded-full px-5 text-[12px] font-semibold uppercase tracking-[0.06em] shadow-[0_7px_24px_rgba(0,0,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-[46px] sm:px-6 sm:text-[13px]"
              >
                {t("cta")}
                <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
              </Link>
            </div>

            {t("trustBody").trim() ? (
              <p className="mx-auto max-w-[52ch] text-balance text-center text-[11px] font-normal leading-relaxed text-[#86868b] sm:text-[12px] sm:leading-relaxed">
                {t("trustBody")}
              </p>
            ) : null}

          </div>
      </div>
    </section>
  );
}
