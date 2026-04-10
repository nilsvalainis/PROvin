import { Fragment } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { getMessages } from "next-intl/server";
import { NavChevronDown, NavChevronRight } from "@/components/NavChevron";
import { homeContentMaxClass } from "@/lib/home-layout";

const connectorClass = "inline-flex shrink-0 text-[#0061D2]/55";

type Step = { n: string; title: string; body: string };

/**
 * Mobilā: −20% pret iepriekšējo (48→38.4px, 40→32px); sm+: 54px kā iepriekš.
 * Web: ikonu rinda sm:w-4/5 — horizontālais solis starp centriem ~−20%.
 */
const stepIconClass =
  "h-[2.4rem] w-[2.4rem] shrink-0 text-[#0061D2] [stroke-width:1.5] max-[360px]:h-8 max-[360px]:w-8 sm:h-[3.375rem] sm:w-[3.375rem]";

const chevronBetweenClass = "h-5 w-5 sm:h-6 sm:w-6";

export async function HowItWorks() {
  const messages = await getMessages();
  const steps = (messages as { HowItWorks: { steps: Step[] } }).HowItWorks.steps;

  return (
    <section className="relative z-10 overflow-visible bg-transparent">
      <div className="relative px-4 py-4 sm:px-6 sm:py-4">
        <div className={`relative ${homeContentMaxClass}`}>
          <div className="flex h-10 items-center justify-center sm:h-11" aria-hidden>
            <span className={connectorClass}>
              <NavChevronDown />
            </span>
          </div>
          <div className="relative mx-auto w-full min-w-0 max-w-lg md:max-w-none">
            <div className="w-full sm:mx-auto sm:w-4/5">
              <div className="flex flex-row items-center justify-center gap-0 px-0.5">
                {steps.map((s, i) => (
                  <Fragment key={`icon-${s.n}`}>
                    <div className="flex min-w-0 flex-1 basis-0 justify-center">
                      <StepIcon n={s.n} />
                    </div>
                    {i < steps.length - 1 ? (
                      <span className={`${connectorClass} mx-0.5 shrink-0 sm:mx-1`} aria-hidden>
                        <NavChevronRight className={chevronBetweenClass} />
                      </span>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <div className="mt-2 flex flex-row justify-center gap-0 px-0.5 sm:mt-3 sm:gap-1">
                {steps.map((s) => (
                  <div key={`text-${s.n}`} className="min-w-0 flex-1 basis-0 px-0.5 text-center sm:px-1">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#1d1d1f] sm:text-[12px]">
                      {s.title}
                    </h3>
                    {s.body.trim() ? (
                      <p className="mt-1.5 text-[10px] font-normal leading-snug text-[#86868b] sm:mt-2 sm:text-[12px] sm:leading-relaxed">
                        {s.body}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepIcon({ n }: { n: string }) {
  const cls = stepIconClass;
  if (n === "1") {
    return <ClipboardPenLine className={cls} aria-hidden strokeWidth={1.5} />;
  }
  if (n === "2") {
    return <CreditCard className={cls} aria-hidden strokeWidth={1.5} />;
  }
  return <ScrollText className={cls} aria-hidden strokeWidth={1.5} />;
}
