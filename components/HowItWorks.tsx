import { Fragment } from "react";
import { getMessages } from "next-intl/server";
import { NavChevronDown, NavChevronRight } from "@/components/NavChevron";
import { homeContentMaxClass } from "@/lib/home-layout";

const connectorClass = "inline-flex shrink-0 text-provin-accent/80";

type Step = { n: string; title: string; body: string };

export async function HowItWorks() {
  const messages = await getMessages();
  const steps = (messages as { HowItWorks: { steps: Step[] } }).HowItWorks.steps;

  return (
    <div className="relative z-10 px-4 pb-4 pt-10 sm:px-6 sm:pb-6 sm:pt-14">
      <div className={`relative ${homeContentMaxClass}`}>
        <div className="mx-auto flex min-w-0 max-w-lg flex-col md:max-w-none md:flex-row md:items-stretch md:justify-center md:gap-0">
          {steps.map((s, i) => (
            <Fragment key={s.n}>
              <article className={`${cardClass} flex min-w-0 flex-col justify-center`}>
                <div className="flex items-start gap-4">
                  <StepBadge n={s.n} />
                  <h3 className="min-w-0 flex-1 pt-1 text-[17px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[18px]">
                    {s.title}
                  </h3>
                </div>
                {s.body.trim() ? (
                  <p className="mt-4 max-w-[65ch] text-[13px] font-normal leading-relaxed text-[#86868b] sm:text-[14px]">
                    {s.body}
                  </p>
                ) : null}
              </article>
              {i < steps.length - 1 && (
                <>
                  <div className="flex justify-center py-3 md:hidden" aria-hidden>
                    <span className={connectorClass}>
                      <NavChevronDown />
                    </span>
                  </div>
                  <div className="hidden shrink-0 items-center justify-center self-center px-2 md:flex" aria-hidden>
                    <span className={connectorClass}>
                      <NavChevronRight />
                    </span>
                  </div>
                </>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
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
