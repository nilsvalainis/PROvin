import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PricingTransitionAndComparison } from "@/components/PricingTransitionAndComparison";
import { irissAnchorHref } from "@/lib/paths";
import { homeContentMaxClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  titleStar?: boolean;
  href?: boolean;
};

const pillarRowClass =
  "provin-lift-subtle flex min-h-0 gap-3.5 rounded-xl border border-black/[0.08] bg-white p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-5";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section id="cena" className="relative scroll-mt-16 bg-white px-4 pt-8 sm:px-6 md:pt-16">
      <div className={`relative ${homeContentMaxClass}`}>
        <PricingTransitionAndComparison />

        <ul className="mt-8 grid list-none grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((item, i) => {
            const inner = (
              <>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
                    {item.title}
                    {item.titleStar ? (
                      <span className="ml-0.5 align-super text-[11px] font-normal text-[#86868b]">*</span>
                    ) : null}
                  </h3>
                  <p className="mt-1.5 text-[13px] font-normal leading-relaxed text-[#86868b] sm:text-[14px] sm:leading-relaxed">
                    {item.body}
                  </p>
                  {item.titleStar ? (
                    <p className="mt-2 text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]">
                      {t("autoRecordsFootnote")}
                    </p>
                  ) : null}
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
