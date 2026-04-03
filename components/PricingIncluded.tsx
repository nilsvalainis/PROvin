import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { irissAnchorHref } from "@/lib/paths";

type GridItem = {
  title: string;
  body: string;
  titleStar?: boolean;
  href?: boolean;
};

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;
  const mainBullets = (messages as { Pricing: { mainBullets: string[] } }).Pricing.mainBullets;
  const stats = (messages as { Pricing: { stats: { value: string; label: string }[] } }).Pricing.stats;

  return (
    <section
      id="cena"
      className="relative scroll-mt-16 overflow-hidden bg-gradient-to-b from-provin-surface-2 via-[#f5f5f7] to-[#f5f5f7] px-4 py-7 sm:px-6 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 provin-noise opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-[1024px]">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[12px]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1.5 text-[24px] font-semibold leading-[1.12] tracking-tight text-[#1d1d1f] sm:mt-2 sm:text-[30px] sm:leading-[1.1]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-1.5 max-w-[65ch] text-[15px] font-normal leading-snug text-[#86868b] sm:mt-2 sm:text-[17px] sm:leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:mt-7 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          <div
            className={`provin-lift-strong overflow-hidden rounded-xl border border-black/[0.06] bg-[#fbfbfd] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:col-span-2 sm:p-5 lg:col-span-2`}
          >
            <div className="text-left">
              <p className="inline-flex items-center rounded-full bg-provin-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:px-3 sm:text-[11px]">
                {t("fullService")}
              </p>
              <h3 className="mt-2.5 max-w-none text-[19px] font-semibold leading-[1.2] tracking-tight text-[#1d1d1f] sm:mt-3 sm:text-[22px] sm:leading-[1.15]">
                {t("mainTitle")}
              </h3>
              <ul className="mt-3 space-y-2 text-[14px] leading-snug text-[#6e6e73] sm:mt-4 sm:text-[15px] sm:leading-relaxed">
                {mainBullets.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span
                      className="mt-[0.35rem] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-provin-accent/10 text-provin-accent sm:h-5 sm:w-5"
                      aria-hidden
                    >
                      <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2 border-t border-black/[0.06] pt-4 sm:mt-5 sm:grid-cols-4 sm:gap-x-3 sm:pt-4">
              {stats.map((row) => (
                <div key={row.label} className="provin-lift-subtle rounded-lg border border-transparent px-0.5 py-0.5">
                  <p className="text-[17px] font-semibold tabular-nums tracking-tight text-[#1d1d1f] sm:text-[20px]">
                    {row.value}
                  </p>
                  <p className="mt-0.5 text-[10px] font-normal leading-tight text-[#86868b] sm:text-[11px]">
                    {row.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {grid.map((item) => {
            const inner = (
              <>
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-provin-accent shadow-sm ring-1 ring-black/[0.04]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-[16px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[17px]">
                  {item.title}
                  {item.titleStar ? (
                    <span className="ml-0.5 align-super text-[11px] font-normal text-[#86868b]">*</span>
                  ) : null}
                </h4>
                <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#86868b] sm:text-[13px] sm:leading-relaxed">{item.body}</p>
                {item.href ? (
                  <p className="mt-2 text-[11px] font-medium text-provin-accent sm:text-[12px]">
                    {t("irissLink")} <span aria-hidden>↓</span>
                  </p>
                ) : null}
              </>
            );
            if (item.href) {
              return (
                <Link key={item.title} href={irissHref} className={irissCardClass}>
                  {inner}
                </Link>
              );
            }
            return (
              <article key={item.title} className={cardClass}>
                {inner}
              </article>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}

const cardClass =
  "provin-lift rounded-xl border border-black/[0.06] bg-[#fbfbfd] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-5";

const irissCardClass =
  "provin-lift-strong block cursor-pointer rounded-xl border border-provin-accent/20 bg-gradient-to-b from-provin-accent-soft/90 to-[#eef6ff] p-4 text-left shadow-[0_2px_16px_rgba(0,102,214,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:p-5";
