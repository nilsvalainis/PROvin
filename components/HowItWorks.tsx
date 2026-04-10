import { Fragment } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { getMessages } from "next-intl/server";
import { homeContentMaxClass } from "@/lib/home-layout";

type Step = { n: string; title: string; body: string };

/**
 * −30% pret iepriekšējo izmēru; pelēka ikona, zila uz hover (group).
 */
const stepIconClass =
  "h-[1.68rem] w-[1.68rem] shrink-0 text-[#6b7280] transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] max-[360px]:h-[1.4rem] max-[360px]:w-[1.4rem] sm:h-[2.3625rem] sm:w-[2.3625rem]";

export async function HowItWorks() {
  const messages = await getMessages();
  const steps = (messages as { HowItWorks: { steps: Step[] } }).HowItWorks.steps;

  return (
    <section className="relative z-10 overflow-visible bg-transparent">
      <div className="relative px-4 py-4 sm:px-6 sm:py-4">
        <div className={`relative ${homeContentMaxClass}`}>
          <div className="flex h-10 items-center justify-center sm:h-11" aria-hidden>
            <div className="h-8 w-px border-l border-dashed border-[#d1d5db]" />
          </div>
          <div className="relative mx-auto w-full min-w-0 max-w-lg md:max-w-none">
            <div className="w-full sm:mx-auto sm:w-4/5">
              <div className="flex flex-row items-center justify-center gap-0 px-0.5">
                {steps.map((s, i) => (
                  <Fragment key={`icon-${s.n}`}>
                    <div className="group flex min-w-0 flex-1 basis-0 justify-center">
                      <StepIcon n={s.n} />
                    </div>
                    {i < steps.length - 1 ? (
                      <div
                        key={`conn-${s.n}`}
                        className="mx-1 min-h-0 min-w-[0.65rem] flex-1 border-t border-dashed border-[#d1d5db] sm:mx-2 sm:min-w-[1.25rem]"
                        aria-hidden
                      />
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <div className="mt-2 flex flex-row justify-center gap-0 px-0.5 sm:mt-3 sm:gap-1">
                {steps.map((s) => (
                  <div key={`text-${s.n}`} className="min-w-0 flex-1 basis-0 px-0.5 text-center sm:px-1">
                    <h3 className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#1d1d1f] sm:text-[10px]">
                      {s.title}
                    </h3>
                    {s.body.trim() ? (
                      <p className="mt-1.5 text-[10px] font-normal leading-snug text-[#86868b] sm:mt-2 sm:text-[11px] sm:leading-relaxed">
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
