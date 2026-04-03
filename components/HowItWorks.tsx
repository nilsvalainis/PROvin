import { Fragment } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

type Step = { n: string; title: string; body: string };

export async function HowItWorks() {
  const t = await getTranslations("HowItWorks");
  const locale = await getLocale();
  const messages = await getMessages();
  const steps = (messages as { HowItWorks: { steps: Step[] } }).HowItWorks.steps;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-provin-surface-2/50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0 provin-noise opacity-30" aria-hidden />
      <div className="relative mx-auto min-w-0 max-w-[1024px]">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("eyebrow")}</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#1d1d1f] sm:text-[36px] sm:leading-[1.1]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-2 max-w-[65ch] text-[16px] font-normal text-[#86868b] sm:text-[17px]">
            {t("subtitle")}
          </p>
        </div>

        <div className="mx-auto mt-10 flex min-w-0 max-w-lg flex-col md:max-w-none md:flex-row md:items-stretch md:justify-center md:gap-0">
          {steps.map((s, i) => (
            <Fragment key={s.n}>
              <article className={`${cardClass} flex min-w-0 flex-col`}>
                <div className="mb-4 flex items-start gap-4">
                  <StepBadge n={s.n} />
                  <h3 className="min-w-0 flex-1 pt-1 text-[17px] font-semibold leading-snug tracking-tight text-[#1d1d1f]">
                    {s.title}
                  </h3>
                </div>
                <p className="max-w-[65ch] text-[13px] font-normal leading-relaxed text-[#86868b] sm:text-[14px]">{s.body}</p>
              </article>
              {i < steps.length - 1 && (
                <>
                  <ArrowDown />
                  <ArrowRight />
                </>
              )}
            </Fragment>
          ))}
        </div>

        <div className="provin-lift-strong mx-auto mt-10 max-w-[640px] rounded-xl border border-black/[0.06] bg-[#fbfbfd] p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("ctaEyebrow")}</p>
          <p className="mt-2 text-[20px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[24px]">{t("ctaHeadline")}</p>
          <Link
            href={orderSectionHref(locale)}
            className="provin-btn mt-5 inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-full px-8 text-[17px] font-normal shadow-[0_4px_16px_rgba(0,102,214,0.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:w-auto"
          >
            {t("ctaButton")}
          </Link>
        </div>
      </div>
    </section>
  );
}

const cardClass =
  "provin-lift flex-1 rounded-xl border border-black/[0.06] bg-[#fbfbfd] p-5 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-6";

function StepBadge({ n }: { n: string }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[17px] font-semibold tabular-nums text-white shadow-[0_4px_14px_rgba(0,102,214,0.35)] ring-2 ring-white"
      aria-hidden
    >
      {n}
    </div>
  );
}

function ArrowRight() {
  return (
    <div
      className="hidden shrink-0 items-center justify-center self-center px-1 md:flex"
      aria-hidden
    >
      <div className="flex items-center gap-0">
        <div className="h-px w-4 bg-gradient-to-r from-provin-accent/25 to-provin-accent/45 sm:w-6" />
        <svg className="h-5 w-5 shrink-0 text-provin-accent/55" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
        </svg>
        <div className="h-px w-4 bg-gradient-to-r from-provin-accent/45 to-provin-accent/15 sm:w-6" />
      </div>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex justify-center py-3 md:hidden" aria-hidden>
      <div className="flex flex-col items-center gap-0">
        <div className="h-5 w-px bg-gradient-to-b from-provin-accent/35 to-provin-accent/50" />
        <svg className="-mt-px h-5 w-5 text-provin-accent/55" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
        <div className="h-3 w-px bg-gradient-to-b from-provin-accent/50 to-transparent" />
      </div>
    </div>
  );
}
