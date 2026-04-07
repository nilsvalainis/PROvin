import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { irissAnchorHref } from "@/lib/paths";
import { homeSectionEyebrowClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

const pillarRowClass =
  "provin-lift-subtle flex min-h-0 gap-3 rounded-xl border border-black/[0.08] bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:p-4";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section className="relative px-4 pb-4 pt-2 sm:px-6 sm:pb-5 sm:pt-3 md:pb-6 md:pt-4">
      <div className="relative mx-auto w-full max-w-[1000px]">
        <h2 className={`${homeSectionEyebrowClass} text-balance text-center`}>{t("workTitle")}</h2>
        <ul className="mt-4 grid list-none grid-cols-1 gap-3 sm:mt-5 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((item, i) => {
              const inner = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-provin-accent-soft/90 text-provin-accent sm:h-11 sm:w-11">
                    <GridIcon index={i} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#86868b] sm:text-[13px] sm:leading-relaxed">
                      {item.body}
                    </p>
                    {item.href ? (
                      <p className="mt-2 text-[11px] font-medium text-provin-accent sm:text-[12px]">
                        {t("irissLink")} <span aria-hidden>↓</span>
                      </p>
                    ) : null}
                  </div>
                </>
              );
              if (item.href) {
                return (
                  <li key={item.title} className="min-w-0">
                    <Link
                      href={irissHref}
                      className={`${pillarRowClass} block min-h-[100%] transition hover:border-black/[0.12] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent`}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.title} className={`${pillarRowClass} min-w-0`}>
                  {inner}
                </li>
              );
            })}
        </ul>
      </div>
    </section>
  );
}

function GridIcon({ index }: { index: number }) {
  const cls = "h-5 w-5 sm:h-[22px] sm:w-[22px]";
  const stroke = 1.75;
  const kind = index % 3;
  if (kind === 0) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4-8-4s-8 1.79-8 4"
        />
      </svg>
    );
  }
  if (kind === 1) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}
