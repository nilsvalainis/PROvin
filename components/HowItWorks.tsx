import { Fragment } from "react";
import { getMessages } from "next-intl/server";
import { NavChevronDown, NavChevronRight } from "@/components/NavChevron";
import { homeContentMaxClass } from "@/lib/home-layout";

const connectorClass = "inline-flex shrink-0 text-provin-accent/80";

type Step = { n: string; title: string; body: string };

export async function HowItWorks({ compact = false }: { compact?: boolean }) {
  const messages = await getMessages();
  const steps = (messages as { HowItWorks: { steps: Step[] } }).HowItWorks.steps;

  return (
    <div className={compact ? "relative z-10" : "relative z-10 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4"}>
      <div className={compact ? "relative" : `relative ${homeContentMaxClass}`}>
        <div
          className={
            compact
              ? "mx-auto flex min-w-0 max-w-full flex-col gap-1"
              : "mx-auto flex min-w-0 max-w-lg flex-col md:max-w-none md:flex-row md:items-stretch md:justify-center md:gap-0"
          }
        >
          {steps.map((s, i) => (
            <Fragment key={s.n}>
              <article
                className={
                  compact
                    ? "flex min-w-0 items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/70 px-2.5 py-2 text-left shadow-[0_1px_6px_rgba(0,0,0,0.04)] backdrop-blur-[2px]"
                    : "flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-2 text-center sm:px-4"
                }
              >
                <div
                  className="text-provin-accent drop-shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
                  aria-hidden
                >
                  <StepIcon n={s.n} compact={compact} />
                </div>
                <h3
                  className={
                    compact
                      ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-provin-accent sm:text-[12px]"
                      : "mt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[13px]"
                  }
                >
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
                  <div className={compact ? "flex justify-center py-0.5" : "flex justify-center py-3 md:hidden"} aria-hidden>
                    <span className={connectorClass}>
                      <NavChevronDown />
                    </span>
                  </div>
                  <div
                    className={compact ? "hidden" : "hidden shrink-0 items-center justify-center self-center px-2 md:flex"}
                    aria-hidden
                  >
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

const BLUE = "var(--color-provin-accent)";

function StepIcon({ n, compact = false }: { n: string; compact?: boolean }) {
  const box = compact ? "h-[52px] w-[52px] sm:h-[58px] sm:w-[58px]" : "h-[76px] w-[76px] sm:h-[84px] sm:w-[84px]";
  if (n === "1") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6.2 3.8h11.6c1 0 1.8.8 1.8 1.8v12.8c0 1-.8 1.8-1.8 1.8H6.2c-1 0-1.8-.8-1.8-1.8V5.6c0-1 .8-1.8 1.8-1.8z"
          fill={BLUE}
        />
        <path d="M7.6 8.4h8.8M7.6 11.8h8.8M7.6 15.2h5.7" stroke="#ffffff" strokeWidth={1.35} strokeLinecap="round" />
        <path d="M6.9 6.3h10.2" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.1} strokeLinecap="round" />
      </svg>
    );
  }
  if (n === "2") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4.2 6.1h15.6c1.1 0 2 .9 2 2v7.8c0 1.1-.9 2-2 2H4.2c-1.1 0-2-.9-2-2V8.1c0-1.1.9-2 2-2z" fill={BLUE} />
        <path d="M2.6 10.6h18.8" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.15} strokeLinecap="round" />
        <rect x="5.1" y="12.3" width="4.5" height="3.3" rx="0.6" stroke="#ffffff" strokeWidth={1.15} />
        <path d="M13.6 14.2h5.2M13.6 15.9h3.6" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.4 18.8 5.9v5.8c0 4.4-2.9 7.7-6.8 9.3-3.9-1.6-6.8-4.9-6.8-9.3V5.9z" fill={BLUE} />
      <path d="m9.4 12.3 1.9 1.9 3.6-3.6" stroke="#ffffff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6.4c2 .9 3.3 1.6 3.3 1.6v3.9c0 2.7-1.8 4.8-3.3 5.5-1.5-.7-3.3-2.8-3.3-5.5V8s1.3-.7 3.3-1.6z" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1} />
    </svg>
  );
}
