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
              <article className="flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-2 text-center sm:px-4">
                <div
                  className="text-provin-accent drop-shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
                  aria-hidden
                >
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

function StepIcon({ n }: { n: string }) {
  const box = "h-[76px] w-[76px] sm:h-[84px] sm:w-[84px]";
  if (n === "1") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="3.5" width="14" height="17" rx="2" fill="white" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M8 8.5h8M8 12h8M8 15.5h5.5"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (n === "2") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="6" width="17" height="12" rx="2.5" fill="white" stroke="currentColor" strokeWidth={1.5} />
        <rect x="5.5" y="8.5" width="4" height="3" rx="0.6" fill="white" stroke="currentColor" strokeWidth={1.2} />
        <path d="M3.5 11.5h17" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" opacity={0.35} />
        <path d="M14 15.5h5" stroke="currentColor" strokeWidth={1.15} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="17" rx="2" fill="white" stroke="currentColor" strokeWidth={1.5} />
      <path d="M8 7h8M8 9.8h6" stroke="currentColor" strokeWidth={1.15} strokeLinecap="round" />
      <path d="M5 12.5h14" stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.2} />
      <circle cx="12" cy="16.5" r="3" fill="white" stroke="currentColor" strokeWidth={1.35} />
      <path
        d="m10.25 16.5 1.15 1.15 2.45-2.45"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
