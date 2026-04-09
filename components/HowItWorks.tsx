import { Fragment } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { getMessages } from "next-intl/server";
import { NavChevronDown, NavChevronRight } from "@/components/NavChevron";
import { homeContentMaxClass } from "@/lib/home-layout";

const connectorClass = "inline-flex shrink-0 text-[#0061D2]/55";

type Step = { n: string; title: string; body: string };

/** Tāds pats kontūras stils kā `PricingIncluded` 9-bloku ikonām (#0061D2, stroke 1.5). */
const stepIconClass =
  "h-8 w-8 shrink-0 text-[#0061D2] [stroke-width:1.5] sm:h-9 sm:w-9";

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
          <div className="relative mx-auto flex min-w-0 max-w-lg flex-col gap-1 md:max-w-none md:flex-row md:items-stretch md:justify-center md:gap-1">
            {steps.map((s, i) => (
              <Fragment key={s.n}>
                <article className="group flex min-w-0 flex-1 flex-col items-center justify-center px-2 py-0 text-center sm:px-3 md:w-[180px] md:flex-none">
                  <div
                    className="flex items-center justify-center transition-[opacity,transform] duration-200 ease-out group-hover:opacity-95 md:min-h-[2.25rem]"
                    aria-hidden
                  >
                    <StepIcon n={s.n} />
                  </div>
                  <h3 className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#1d1d1f] sm:text-[12px]">
                    {s.title}
                  </h3>
                  {s.body.trim() ? (
                    <p className="mt-2 max-w-[65ch] text-[11px] font-normal leading-relaxed text-[#86868b] sm:mt-3 sm:text-[12px] sm:leading-relaxed">
                      {s.body}
                    </p>
                  ) : null}
                </article>
                {i < steps.length - 1 && (
                  <>
                    <div className="flex justify-center md:hidden" aria-hidden>
                      <span className={connectorClass}>
                        <NavChevronDown />
                      </span>
                    </div>
                    <div className="hidden h-[52px] w-6 shrink-0 self-start items-center justify-center md:flex" aria-hidden>
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
