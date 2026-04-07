import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { NavChevronDown } from "@/components/NavChevron";
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
        className="mx-auto flex min-h-[100svh] min-w-0 max-w-[640px] flex-col justify-between gap-4 px-4 pb-5 pt-[max(0.85rem,env(safe-area-inset-top))] text-center md:min-h-0 md:gap-10 md:pb-14 md:pt-14 md:text-center"
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
            <ul className="mx-auto grid w-full max-w-[560px] gap-2.5 text-left md:gap-3">
              {pillars.map((p, i) => (
                <li key={i}>
                  <article className="provin-lift-subtle flex min-w-0 gap-3 rounded-2xl border border-black/[0.045] bg-white/55 px-3 py-2.5 shadow-[0_2px_24px_rgba(15,23,42,0.05)] backdrop-blur-[3px] sm:gap-3.5 sm:px-3.5 sm:py-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-provin-accent-soft/90 text-provin-accent sm:h-11 sm:w-11"
                      aria-hidden
                    >
                      <PillarGlyph index={i} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <h3 className="text-[13px] font-semibold leading-tight tracking-tight text-[#1d1d1f] sm:text-[15px]">
                        {p.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-normal leading-snug text-[#6e6e73] sm:text-[12px] sm:leading-relaxed">
                        {p.body}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
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

            <p className="mx-auto max-w-[52ch] text-balance text-center text-[11px] font-normal leading-relaxed text-[#86868b] sm:text-[12px] sm:leading-relaxed">
              {t("trustBody")}
            </p>

            <div className="flex justify-center pt-0.5">
              <a
                href="#cena"
                aria-label={t("scrollToPricingAria")}
                className="inline-flex text-provin-accent/80 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
              >
                <NavChevronDown />
              </a>
            </div>
          </div>
      </div>
    </section>
  );
}

function PillarGlyph({ index }: { index: number }) {
  const cls = "h-5 w-5 sm:h-[22px] sm:w-[22px]";
  const stroke = 1.75;
  switch (index) {
    case 0:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4-8-4s-8 1.79-8 4"
          />
        </svg>
      );
    case 1:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
  }
}
