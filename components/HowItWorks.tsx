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
              <article className={`${cardClass} flex min-w-0 flex-col items-center justify-center text-center`}>
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-provin-accent text-white shadow-[0_10px_24px_rgba(0,102,214,0.28)] ring-2 ring-white sm:h-[80px] sm:w-[80px]">
                  <StepIcon n={s.n} />
                </div>
                <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[13px]">
                  {s.title}
                </h3>
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
  "provin-lift flex-1 rounded-xl border border-black/[0.06] bg-[#fbfbfd] p-5 sm:p-6";

function StepIcon({ n }: { n: string }) {
  const className = "h-8 w-8 sm:h-9 sm:w-9";
  if (n === "1") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="5" y="4.5" width="14" height="15" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (n === "2") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
        <path d="M3.5 10.5h17M8 15h3" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 3.8 18.5 6v5.4c0 4.1-2.8 7.2-6.5 8.8-3.7-1.6-6.5-4.7-6.5-8.8V6z" />
      <path d="m9.5 12.2 1.8 1.8 3.4-3.4" />
    </svg>
  );
}
