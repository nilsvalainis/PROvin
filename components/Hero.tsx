import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroServiceGrid } from "@/components/HeroServiceGrid";
import { orderSectionHref } from "@/lib/paths";

type Pillar = { title: string; body: string };

/** „APPROVED BY IRISS” paraksts. */
const signatureTextClass =
  "font-light uppercase tracking-[0.32em] text-[#8e8e93] sm:tracking-[0.38em] text-[0.5625rem] leading-relaxed sm:text-[0.625rem]";

/**
 * Apakšvirsraksts — „organiski”: kā parasts teikums zem H1, ne kā zīmogs un ne kā sīks paraksts.
 * Lasāms izmērs, neitrāls mīksts tonis, normāls svars — lai šķiet redakcionāls, ne UI elements.
 */
const heroSubtitleClass =
  "max-w-[min(100%,34ch)] text-balance font-normal leading-relaxed tracking-tight text-[#4f4f56] text-[15px] sm:text-[17px]";

export async function Hero() {
  const t = await getTranslations("Hero");
  const locale = await getLocale();
  const messages = await getMessages();
  const pillars = (messages as { Hero: { pillars: Pillar[] } }).Hero.pillars;

  return (
    <section>
      <div
        className="mx-auto flex min-w-0 max-w-[min(100%,44.8rem)] flex-col text-center max-sm:min-h-0 max-sm:justify-start max-sm:gap-7 max-sm:px-5 max-sm:pb-10 max-sm:pt-[max(1.75rem,env(safe-area-inset-top))] sm:min-h-[100svh] sm:justify-between sm:gap-4 sm:px-4 sm:pb-4 sm:pt-[max(0.85rem,env(safe-area-inset-top))] md:min-h-0 md:gap-10 md:pb-5 md:pt-14 md:text-center"
      >
          <header className="shrink-0 space-y-0">
            <p className={signatureTextClass} aria-label={t("approved")}>
              {t("approved")}
            </p>

            <h1 className="mt-5 text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[28px] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]">
              <span className="block text-[#1d1d1f]">{t("h1Line1")}</span>
              <span className="mt-0.5 block text-provin-accent sm:mt-1">{t("h1Line2")}</span>
            </h1>

            <h2 className={`mx-auto mt-3 md:mt-4 ${heroSubtitleClass}`}>
              {t("h2")}
            </h2>
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
                className="provin-btn provin-btn--compact inline-flex min-h-[43px] w-auto max-w-full items-center justify-center rounded-full px-[22px] text-[12px] font-semibold uppercase tracking-[0.06em] shadow-[0_7px_24px_rgba(0,0,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-[47px] sm:px-9 sm:text-[13px]"
              >
                {t("cta")}
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
