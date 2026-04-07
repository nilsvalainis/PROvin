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
const BLUE_SOFT = "#e8f2fc";

function StepIcon({ n }: { n: string }) {
  const box = "h-[76px] w-[76px] sm:h-[84px] sm:w-[84px]";
  if (n === "1") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <defs>
          <linearGradient id="how-form-face-1" x1="5" y1="4.5" x2="5" y2="19.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor={BLUE_SOFT} />
          </linearGradient>
        </defs>
        <rect x="5" y="4.5" width="14" height="15" rx="2" fill="url(#how-form-face-1)" stroke={BLUE} strokeWidth={1.75} />
        <rect x="6.25" y="5.5" width="11.5" height="3.35" rx="0.75" fill={BLUE} fillOpacity={0.28} />
        <path
          d="M8 11.1h8M8 14.1h8M8 17.1h5"
          stroke={BLUE}
          strokeWidth={1.65}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (n === "2") {
    return (
      <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
        <defs>
          <linearGradient id="how-card-body-2" x1="3.5" y1="6.5" x2="3.5" y2="17.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor={BLUE_SOFT} />
          </linearGradient>
        </defs>
        <rect x="3.5" y="6.5" width="17" height="11" rx="2.25" fill="url(#how-card-body-2)" stroke={BLUE} strokeWidth={1.75} />
        <rect x="3.5" y="6.5" width="17" height="4.35" rx="2.25" fill={BLUE} fillOpacity={0.24} />
        <path d="M3.5 10.75h17" stroke={BLUE} strokeOpacity={0.45} strokeWidth={1.35} strokeLinecap="round" />
        <rect x="5.5" y="12.25" width="4.25" height="3.25" rx="0.65" fill="#ffffff" stroke={BLUE} strokeWidth={1.45} />
        <path
          d="M7.1 13.9h1.1M7.1 14.9h1.1"
          stroke={BLUE}
          strokeOpacity={0.55}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
        <path d="M13.5 15.5h5.5" stroke={BLUE} strokeOpacity={0.35} strokeWidth={1.2} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={box} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="how-shield-fill-3" x1="12" y1="3.8" x2="12" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor={BLUE_SOFT} />
        </linearGradient>
      </defs>
      <path
        d="M12 3.8 18.5 6v5.4c0 4.1-2.8 7.2-6.5 8.8-3.7-1.6-6.5-4.7-6.5-8.8V6z"
        fill="url(#how-shield-fill-3)"
        stroke={BLUE}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <path
        d="M12 5.9c2.1 1 3.5 1.7 3.5 1.7v4.1c0 2.9-1.9 5.1-3.5 5.9-1.6-.8-3.5-3-3.5-5.9V7.6s1.4-.7 3.5-1.7z"
        fill={BLUE}
        fillOpacity={0.1}
      />
      <path
        d="m9.5 12.2 1.8 1.8 3.4-3.4"
        stroke={BLUE}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
