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

const BLUE = "var(--color-provin-accent)";
const INK = "#111827";

function StepIcon({ n }: { n: string }) {
  const box = "h-[76px] w-[76px] sm:h-[84px] sm:w-[84px]";
  if (n === "1") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="4.5" width="14" height="15" rx="2.25" stroke={INK} strokeWidth={1.7} />
        <path d="M8 8.5h8M8 12h8M8 15.5h5.5" stroke={INK} strokeWidth={1.55} strokeLinecap="round" />
        <path d="M6.8 6.4h10.4" stroke={BLUE} strokeWidth={1.9} strokeLinecap="round" />
        <circle cx="16.2" cy="6.4" r="1.05" fill={BLUE} />
      </svg>
    );
  }
  if (n === "2") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" stroke={INK} strokeWidth={1.7} />
        <path d="M3.7 10.7h16.6" stroke={INK} strokeWidth={1.3} strokeOpacity={0.5} strokeLinecap="round" />
        <rect x="5.4" y="12.2" width="4.4" height="3.4" rx="0.7" stroke={BLUE} strokeWidth={1.4} />
        <path d="M13.7 14.1h5.2" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        <path d="M13.7 15.9h3.6" stroke={BLUE} strokeWidth={1.6} strokeLinecap="round" />
        <circle cx="18.8" cy="8.4" r="0.95" fill={BLUE} />
      </svg>
    );
  }
  return (
    <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.8 18.5 6v5.4c0 4.1-2.8 7.2-6.5 8.8-3.7-1.6-6.5-4.7-6.5-8.8V6z" stroke={INK} strokeWidth={1.7} />
      <path d="M12 6.3c1.8.8 3 1.4 3 1.4v3.8c0 2.6-1.7 4.5-3 5.2-1.3-.7-3-2.6-3-5.2V7.7s1.2-.6 3-1.4z" stroke={BLUE} strokeWidth={1.35} />
      <path d="m9.7 12.3 1.6 1.6 3.1-3.1" stroke={BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.8" cy="8" r="0.95" fill={BLUE} />
    </svg>
  );
}
